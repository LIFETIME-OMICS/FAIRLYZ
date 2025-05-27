const fs = require('fs');
const csv = require('csv-parser');
const express = require('express');
const app = express();
const multer = require('multer');
const { encoding_for_model } = require("@dqbd/tiktoken");
const dotenv = require("dotenv");
const OpenAI = require("openai");
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
let apiCallCount = 0;
let totalInputTokens = 0;
let totalOutputTokens = 0;


app.use(express.json());

const detectAndFormatEncodedValues = ( values,  columnName, options = {}
) => {
  const maxUnique = options.maxUnique || 20;
  const thresholdRatio = options.thresholdRatio || 0.1;
  const forceEncodedColumns = options.forceEncodedColumns || [];
  const forceEncodeColumnName = options.forceEncodeColumnName || null;
  const normalizedValues = values
  .filter((v) => v !== null && v !== undefined && v.toString().trim() !== "")
  .map((v) => (typeof v === 'string' ? v.trim() : v));

  const uniqueValues = [...new Set(normalizedValues)].sort();

  if (
    forceEncodedColumns.includes(columnName) ||
    forceEncodeColumnName === columnName
  ) {
    console.log(`Column ${columnName} is forced to be encoded.`);
    return uniqueValues.map((value) => `${value}=?`).join(';');
  }

  const threshold = thresholdRatio * normalizedValues.length;

  if (
    uniqueValues.length > 0 &&
    uniqueValues.length <= Math.max(threshold, maxUnique)
  ) {
    console.log(
      `Column ${columnName} has ${uniqueValues.length} unique values, encoding it.`
    );
    return uniqueValues.map((value) => `${value}=?`).join(';');
  }

  return null;
};

const guessEncodedMeaningsBatch = async (columnName, keys) => {
  apiCallCount++;
  const keysString = keys.join('; ');

  const prompt = `You are a data labeling assistant. For the given column name and encoded values, provide:

1. Short labels for each encoded value (separated by semicolons).
2. A short, clear description of what the column represents.

Column name: ${columnName}
Encoded values: ${keysString}

Response format:
Labels: no quotes, no explanation,Do NOT include the encoded value do not say "1 = Male" Do NOT shorten or abbreviate the labels.(e.g., do not say Male = M )
Description: Your short description here`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
    });

    const rawOutput = response.choices[0].message.content.trim();
    console.log("Raw OpenAI output:", rawOutput);

    const enc = encoding_for_model("gpt-4");
    totalInputTokens += enc.encode(prompt).length;
    totalOutputTokens += enc.encode(rawOutput).length;

    const labelsLine = rawOutput.match(/Labels:(.*)/i);
    const descriptionLine = rawOutput.match(/Description:(.*)/i);

    if (!descriptionLine) {
    console.warn(` Description not matched in: ${rawOutput}`);
  }

    const labels = labelsLine ? labelsLine[1].trim().split(";").map(l => l.trim()) : [];
    const description = descriptionLine ? descriptionLine[1].trim() : "?";

    const labelMap = {};
    keys.forEach((key, i) => {
      labelMap[key] = labels[i] || "?";
    });

    return { labelMap, description };

  } catch (error) {
    console.error("OpenAI error:", error.message);
    const fallbackMap = keys.reduce((acc, key) => {
      acc[key] = "?";
      return acc;
    }, {});
    return { labelMap: fallbackMap, description: "?" };
  }
};



const determineType = (values, columnName) => {
  const cleaned = values.filter(v => v !== "").map(v => v.trim());

  if (cleaned.length === 0) return "string"; 
  const allNumeric = cleaned.every((v) => !isNaN(v));
  const uniqueValues = new Set(cleaned);

  if (allNumeric) {
    return uniqueValues.size > 8
      ? cleaned.some((v) => v.includes(".")) ? "decimal" : "integer"
      : "encoded value";
  }

  if (uniqueValues.size <= Math.max(0.2 * cleaned.length, 30)) {
    return "encoded value";
  }

  return "string";
};

// Timestamp helper
const getCurrentTimestamp = () => new Date().toISOString();

const processColumnUpdate = (columnName, newType, inputFile, res) => {
  
  if (!columnName || !newType || !inputFile) {
    return res.status(400).send("Missing required parameters");
  }

  const columns = {};
  fs.createReadStream(inputFile)
    .pipe(csv())
    .on("data", (row) => {
      Object.keys(row).forEach((column) => {
        if (!columns[column]) columns[column] = [];
        columns[column].push(row[column]);
      });
    })
    .on("end", () => {
      if (!columns[columnName]) {
        return res.status(404).send(`Column "${columnName}" not found.`);
      }

      const columnValues = columns[columnName];

      if (newType === "encoded value") {
        const encodedValues = detectAndFormatEncodedValues(columnValues, columnName, {
        forceEncodedColumns: [columnName]
    }

        );
        //console.log("Encoded Values sending to UI: ", encodedValues);
        return res.json({ columnName, newType, encodedValues });
      }

      if (newType === "integer" || newType === "decimal") {
        const allNumeric = columnValues.every((value) => !isNaN(value));
        if (allNumeric) {
          const updatedData = columnValues.map((value) =>
            newType === "decimal" && value.includes(".")
              ? parseFloat(value)
              : parseInt(value)
          );
          return res.json({ columnName, newType, updatedData });
        } else {
          return res.status(400).send(`Column "${columnName}" cannot be converted to ${newType}`);
        }
      }

      return res.json({ columnName, newType: "string", updatedData: columnValues });
    });
};

const generateDataDictionary = async (inputFile, outputFile, res) => {
  if (!inputFile || !outputFile) {
    return res.status(400).send("Missing required parameters");
  }

  const columns = {};
  const logFile = "dataDictionary.log";

  fs.createReadStream(inputFile)
    .pipe(csv())
    .on("data", (row) => {
      Object.keys(row).forEach((column) => {
        if (!columns[column]) columns[column] = [];
        columns[column].push(row[column]?.trim() || "");
      });
    })
    .on("end", async () => {
      const dataDict = [];
      const logStream = fs.createWriteStream(logFile, { flags: "a" });

      for (const column of Object.keys(columns)) {
        const values = columns[column];
        const hasMissingValues = values.includes("");

        if (hasMissingValues) {
          logStream.write(`[${getCurrentTimestamp()}] Missing Values in column ${column}\n`);
        }

        const TYPE = determineType(values, column);
        let encodedValues = "";
        const UNITS = "";
        let description = "?"; 

        if (TYPE === "encoded value") {
          const rawEncoded = detectAndFormatEncodedValues(values, column) || "";
          const entries = rawEncoded.split(";").map(e => e.trim());

          const keys = entries.map(entry => entry.split("=")[0]);
          const { labelMap, description: openAIDescription } = await guessEncodedMeaningsBatch(column, keys);

          
          description = openAIDescription; 
          encodedValues = keys.map(key => `${key}=${labelMap[key] || "?"}`).join(";");
          
        }


        dataDict.push({
          VARNAME: column,
          VARDESC: description,
          UNITS,
          TYPE,
          VALUES: encodedValues
        });
      }

      const header = "VARNAME,VARDESC,UNITS,TYPE,VALUES";
      const outputData = dataDict.map((row) =>
        `${row.VARNAME},${row.VARDESC},${row.UNITS},${row.TYPE},${row.VALUES}`
      ).join("\n");

      fs.writeFileSync(outputFile, `${header}\n${outputData}`);
      res.setHeader("Content-Disposition", `attachment; filename=${outputFile}`);
      res.setHeader("Content-Type", "text/csv");
      res.download(outputFile);

      logStream.end();

      console.log(`Data dictionary generated and saved to ${outputFile}`);
      console.log(`API Call Count: ${apiCallCount}`);
      const inputRate = 0.01;
      const outputRate = 0.03;

      const inputCost = (totalInputTokens / 1000) * inputRate;
      const outputCost = (totalOutputTokens / 1000) * outputRate;
      const totalCost = inputCost + outputCost;

      console.log(`\n--- OpenAI API Usage Summary ---`);
      console.log(`Total API calls: ${apiCallCount}`);
      console.log(`Total input tokens: ${totalInputTokens}`);
      console.log(`Total output tokens: ${totalOutputTokens}`);
      console.log(`Estimated input cost: $${inputCost.toFixed(4)}`);
      console.log(`Estimated output cost: $${outputCost.toFixed(4)}`);
      console.log(`Estimated total cost: $${totalCost.toFixed(4)}\n`);

    });
};


// Exporting all functions
module.exports = {
  detectAndFormatEncodedValues,
  determineType,
  getCurrentTimestamp,
  generateDataDictionary,
  processColumnUpdate,
  guessEncodedMeaningsBatch

};

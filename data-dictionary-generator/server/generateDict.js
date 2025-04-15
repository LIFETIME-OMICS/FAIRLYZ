const fs = require("fs");
const csv = require("csv-parser");

// CLI argument parsing
const args = process.argv.slice(2);
const inputIndex = args.indexOf("-i");
const outputIndex = args.indexOf("-o");
const neIndex = args.indexOf("-ne");

if (inputIndex === -1 || outputIndex === -1) {
  console.error("Please provide input (-i) and output (-o) file paths.");
  process.exit(1);
}

const inputFile = args[inputIndex + 1];
const outputFile = args[outputIndex + 1];
const notEncodedColumns = neIndex !== -1 ? args.slice(neIndex + 1) : [];

const detectAndFormatEncodedValues = (values, notEncodedColumns, columnName) => {
  if (notEncodedColumns.includes(columnName)) return null;
  const uniqueValues = [...new Set(values.filter((v) => v !== ""))].sort();
  const threshold = 0.1 * values.length;
  if (uniqueValues.length > 0 && uniqueValues.length <= Math.max(threshold, 20)) {
    return uniqueValues.map((value) => `${value}=?`).join(";");
  }
  return null;
};

const determineType = (values, columnName, notEncodedColumns) => {
  const allEmpty = values.every((value) => value === "");
  if (allEmpty) return "string";

  const nonEmptyValues = values.filter((value) => value !== "");

  if (notEncodedColumns.includes(columnName)) {
    console.log(`Skipping encoding check for column: "${columnName}"`);
    const allNumeric = nonEmptyValues.every((value) => !isNaN(value));
    return allNumeric
      ? nonEmptyValues.some((v) => v.includes(".")) ? "decimal" : "integer"
      : "string";
  }

  if (nonEmptyValues.some((v) => isNaN(v)) && nonEmptyValues.some((v) => !isNaN(v))) {
    return "encoded value";
  }

  const isNumeric = nonEmptyValues.every((v) => !isNaN(v));
  if (isNumeric) {
    const uniqueValues = new Set(nonEmptyValues);
    return uniqueValues.size > 8
      ? nonEmptyValues.some((v) => String(v).includes(".")) ? "decimal" : "integer"
      : "encoded value";
  }

  return "string";
};

const generateDataDictionary = () => {
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
      const dataDict = [];

      Object.keys(columns).forEach((column) => {
        console.log(`Evaluating column: "${column}" for encoded value check`);

        const TYPE = determineType(columns[column], column, notEncodedColumns);
        let encodedValues = "";

        if (TYPE === "encoded value") {
          encodedValues = detectAndFormatEncodedValues(columns[column], notEncodedColumns, column) || "";
        }

        dataDict.push({
          VARNAME: column,
          VARDESC: "?",
          UNITS: "",
          TYPE,
          VALUES: encodedValues,
        });
      });

      const header = "VARNAME,VARDESC,UNITS,TYPE,VALUES";
      const outputData = dataDict
        .map(
          (row) =>
            `${row.VARNAME},${row.VARDESC},${row.UNITS},${row.TYPE},${row.VALUES}`
        )
        .join("\n");

      fs.writeFileSync(outputFile, `${header}\n${outputData}`);
      console.log(`Data dictionary written to ${outputFile}`);
    });
};

generateDataDictionary();

const fs = require("fs");
const path = require("path");
const { DOMParser } = require("@xmldom/xmldom");
const xpath = require("xpath");
const { stringify } = require("csv-stringify/sync");
const yargs = require("yargs");

// Parse command-line arguments
const argv = yargs
  .usage("Usage: node $0 -i input.xml -o output.csv")
  .option("i", { alias: "input", describe: "Input XML file", demandOption: true, type: "string" })
  .option("o", { alias: "output", describe: "Output CSV file", demandOption: true, type: "string" })
  .help().argv;

const inputFile = path.resolve(argv.input);
const outputFile = path.resolve(argv.output);

// Read XML file
fs.readFile(inputFile, "utf-8", (err, data) => {
  if (err) {
    console.error("Error reading input file:", err);
    process.exit(1);
  }

  // Parse XML
  const doc = new DOMParser().parseFromString(data, "text/xml");
  const variables = xpath.select("//variable", doc);

  const csvData = [["VARNAME", "VARDESC", "TYPE", "UNITS", "VALUES"]];

  variables.forEach((variable) => {
    const name = xpath.select1("string(name)", variable);
    const description = xpath.select1("string(description)", variable);
    const type = xpath.select1("string(type)", variable);
    const unit = xpath.select1("string(unit)", variable) || "";
    
    let values = "";
    if (type === "encoded value") {
      const valueNodes = xpath.select("value", variable);
      values = valueNodes
        .map((val) => `${val.getAttribute("code")}=${val.textContent}`)
        .join(";");
    }

    csvData.push([name, description, type, unit, values]);
  });

  // Convert to CSV format
  const csvContent = stringify(csvData);


  // Write to output CSV file
  fs.writeFile(outputFile, csvContent, "utf8", (err) => {
    if (err) {
      console.error("Error writing output file:", err);
      process.exit(1);
    }
    console.log(`CSV file successfully written to ${outputFile}`);
  });
});

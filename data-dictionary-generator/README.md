
# Data Dictionary Designer

A Node.js tool to automatically generate a data dictionary from a CSV file. It identifies data types, encoded values, and missing values, and exports everything into a structured CSV format.

---

##  Getting Started

### 1. Clone or Download This Repo

```bash
git clone https://github.com/LIFETIME-OMICS/FAIRLYZ/data-dictionary-generator.git
cd data-dictionary-generator
```

### 2. Install Dependencies

```bash
npm install
```

---

##  Usage

Run the script using Node.js:

```bash
node generateDict.js -i <input_file> -o <output_file> [-ne <not_encoded_columns>]
```

###  Parameters

| Option | Description |
|--------|-------------|
| `-i` or `--input` | Path to your input CSV file |
| `-o` or `--output` | Path where the generated data dictionary will be saved |
| `-ne` or `--notEncodedColumns` | (Optional) Comma-separated column names that should **not** be treated as encoded |

---

###  Example

```bash
node generateDict.js -i /Test_data.csv -o /Test_data/dictionary_output.csv
```

With excluded columns:

```bash
node generateDict.js -i input.csv -o output.csv -ne id name date
```

---

##  Output

- A CSV file with the following columns: `VARNAME, VARDESC, UNITS, TYPE, VALUES`
- A `dataDictionary.log` file is generated that logs missing value warnings

---

## Example Output CSV

```csv
VARNAME,VARDESC,UNITS,TYPE,VALUES
age,?,,integer,
gender,?,,encoded value,male=?;female=?;other=?
score,?,,decimal,
```

---

## Author

Created by Lichi Mahajan

---



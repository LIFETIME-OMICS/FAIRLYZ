# XML to CSV Conversion Script

This Node.js script converts dbGaP XML files into CSV format. It processes the XML data and formats the encoded values into a clean CSV, making it easy to use for analysis.

## Prerequisites

Ensure you have Node.js installed on your system. If not, download and install it from [Node.js official website](https://nodejs.org/).

## Installation

1. Clone the repository to your local machine:   
```sh   
git clone https://github.com/LIFETIME-OMICS/FAIRLYZ.git  
 ```
2. Navigate to the project folder.
 ```bash
  cd FAIRLYZ 
  ```
3. Install dependencies by running:
    ```bash
      npm install
   ```


## Usage

Run the script using the following command:
 ```bash
    node index.js -i <input-file> -o <output-file>
     ```

Where:
- `-i` (or `--input`) specifies the input XML file.
- `-o` (or `--output`) specifies the output CSV file.
Replace `<input-file>` with the path to your XML file.
Replace `<output-file>` with the desired name for the CSV file.


### Example
```sh
node index.js -i sample.xml -o output.csv
```
This command will:
Read the `sample.xml` file.
Convert the data into CSV format.
Save the output in a file called `output.csv`.


## Output Format
The generated CSV file will have the following columns:
```
VARNAME,VARDESC,TYPE,UNITS,VALUES
```
- `VARNAME`: Variable name from the XML.
- `VARDESC`: Variable description.
- `TYPE`: Data type (e.g., string, integer, encoded value).
- `UNITS`: Measurement units (if available).
- `VALUES`: Encoded values formatted as `code=value;code=value`.

## License
This script is open-source and available for modification and distribution.

## Contributing
We welcome contributions! If you want to help improve this script, feel free to fork the repository and submit a pull request.

import { convertSqlToJson } from './sql-to-json-converter';

/**
 * Script to convert SQL export to JSON format
 * This allows using SQL exports with the JSON import system
 */
async function convertDatabase() {
  try {
    console.log("Starting SQL to JSON conversion...");
    
    // Get file path from command line arguments
    const args = process.argv.slice(2);
    if (args.length === 0) {
      console.error("Please provide a file path to the SQL export");
      return { success: false, error: "No file path provided" };
    }
    
    const sqlFilePath = args[0];
    const jsonFilePath = await convertSqlToJson(sqlFilePath);
    
    console.log(`SQL export converted successfully to: ${jsonFilePath}`);
    return { success: true, path: jsonFilePath };
  } catch (error) {
    console.error("Error converting SQL to JSON:", error);
    return { success: false, error };
  }
}

// Run the conversion if executed directly
if (require.main === module) {
  convertDatabase()
    .then((result) => {
      if (result.success) {
        process.exit(0);
      } else {
        process.exit(1);
      }
    })
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

export { convertDatabase };

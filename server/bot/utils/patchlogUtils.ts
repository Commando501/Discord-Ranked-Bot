
import * as fs from 'fs';
import * as path from 'path';

/**
 * Utility functions for managing patch logs
 */
export const patchLogUtils = {
  /**
   * Get a list of all patch log files
   * @returns Array of patch log file paths
   */
  getPatchLogFiles(): string[] {
    const patchLogDir = path.join(process.cwd(), 'patch_logs');
    if (!fs.existsSync(patchLogDir)) {
      return [];
    }
    return fs.readdirSync(patchLogDir)
      .filter(file => file.endsWith('.md'))
      .map(file => path.join(patchLogDir, file));
  },

  /**
   * Get patch log entries for a specific time period
   * @param year Year to filter by
   * @param quarter Quarter to filter by (1-4)
   * @returns Patch log content or empty string if not found
   */
  getLogForPeriod(year: number, quarter: number): string {
    const fileName = `${year}-Q${quarter}.md`;
    const filePath = path.join(process.cwd(), 'patch_logs', fileName);
    
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8');
    }
    return '';
  },

  /**
   * Add a new entry to the current patch log file
   * @param entry The patch log entry to add
   */
  addPatchLogEntry(entry: string): void {
    const now = new Date();
    const year = now.getFullYear();
    const quarter = Math.floor(now.getMonth() / 3) + 1;
    
    const fileName = `${year}-Q${quarter}.md`;
    const patchLogDir = path.join(process.cwd(), 'patch_logs');
    const filePath = path.join(patchLogDir, fileName);
    
    // Ensure directory exists
    if (!fs.existsSync(patchLogDir)) {
      fs.mkdirSync(patchLogDir, { recursive: true });
    }
    
    // Create file with header if it doesn't exist
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(
        filePath, 
        `# Project Patch Log: ${year} Q${quarter} (${this.getQuarterMonths(quarter)})\n\n`
      );
    }
    
    // Read existing content
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Add new entry after the header
    const headerEndPos = content.indexOf('\n\n') + 2;
    const newContent = content.substring(0, headerEndPos) + entry + '\n\n' + content.substring(headerEndPos);
    
    // Write updated content
    fs.writeFileSync(filePath, newContent);
  },
  
  /**
   * Get month range for a quarter
   * @param quarter Quarter (1-4)
   * @returns String representation of months in the quarter
   */
  getQuarterMonths(quarter: number): string {
    switch(quarter) {
      case 1: return 'January-March';
      case 2: return 'April-June';
      case 3: return 'July-September';
      case 4: return 'October-December';
      default: return '';
    }
  },
  
  /**
   * Search all patch logs for a specific term
   * @param searchTerm Term to search for
   * @returns Object with matching file paths and line numbers
   */
  searchPatchLogs(searchTerm: string): Array<{file: string, matches: Array<{line: number, content: string}>}> {
    const files = this.getPatchLogFiles();
    const results = [];
    
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');
      const matches = [];
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(searchTerm.toLowerCase())) {
          matches.push({
            line: i + 1,
            content: lines[i]
          });
        }
      }
      
      if (matches.length > 0) {
        results.push({
          file: path.basename(file),
          matches
        });
      }
    }
    
    return results;
  }
};

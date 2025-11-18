import { readdir, stat, rm } from 'fs/promises';
import { join } from 'path';
import chalk from 'chalk';
import yoctoSpinner from 'yocto-spinner';
import Profiler from './Profiler.js';

export default async function cleanupReports() {
    const profilingReportsDir = Profiler.profilingResultsDir;
    
    try {
        // Check if profiling-reports directory exists
        await stat(profilingReportsDir);
    } catch (e) {
        console.log(chalk.yellow(`Profiling reports directory not found: ${profilingReportsDir}`));
        return;
    }

    const cleanupSpinner = yoctoSpinner({text: 'Scanning for report folders...'}).start();
    
    try {
        // Read all entries in the profiling-reports directory
        const entries = await readdir(profilingReportsDir, { withFileTypes: true });
        
        // Filter for directories starting with "REPORT_"
        const reportFolders = entries
            .filter(entry => entry.isDirectory() && entry.name.startsWith('REPORT_'))
            .map(entry => entry.name);
        
        if (reportFolders.length === 0) {
            cleanupSpinner.success('No report folders found to delete');
            return;
        }

        cleanupSpinner.text = `Deleting ${reportFolders.length} report folder(s)...`;
        
        // Delete each report folder recursively
        const deletePromises = reportFolders.map(folderName => {
            const folderPath = join(profilingReportsDir, folderName);
            return rm(folderPath, { recursive: true, force: true });
        });
        
        await Promise.all(deletePromises);
        
        cleanupSpinner.success(`Successfully deleted ${reportFolders.length} report folder(s)`);
    } catch (e) {
        cleanupSpinner.error(`Cleanup failed: ${e.message}`);
        throw e;
    }
}


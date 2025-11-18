import { promises as fs } from "fs";
import path from 'path';
import url from 'url';
import Profiler from './Profiler.js';

export default async function generateReport(outputHtmlFile) {
    const dir = await fs.readdir(Profiler.profilingResultsDir);

    const profileReports = [];

    const reportFolders = dir.filter(item => item.startsWith(Profiler.reportFolderPrefix));
    for (const reportFolder of reportFolders) {
        const reportPath = Profiler.profilingResultsDir + '/' + reportFolder;
        let profiles = await fs.readdir(reportPath);

        const files = {
            profilerConfig: reportPath + '/' + Profiler.profilingSessionInfoFile,
            profiles: profiles.filter(item => item != Profiler.profilingSessionInfoFile)
                .map(file => `${reportPath}/${file}`),
        };

        const profilerConfig = JSON.parse(await fs.readFile(files.profilerConfig, 'utf8'));

        const dbReport = {
            profilerConfig: profilerConfig,
            profiles: {}
        };
        for (const profile of files.profiles) {
            let fileName = path.basename(profile);
            fileName = fileName.replace(Profiler.profileFilePrefix, '').replace(/\.json$/, '');
            dbReport.profiles[fileName] = JSON.parse(await fs.readFile(profile, 'utf8'));
        }

        const profileId = reportFolder.replace(Profiler.reportFolderPrefix, '');

        profileReports.push({
            profileId: profileId, 
            ...dbReport
        });
    }

    // generate HTML page
    const resultsTemplatePath = path.join(path.dirname(url.fileURLToPath(import.meta.url)), 'results-template.html');
    const resultsTemplate = await fs.readFile(resultsTemplatePath, 'utf8');

    const resultsHtml = resultsTemplate.replace('{REPORTS_ARRAY_PLACEHOLDER}', JSON.stringify(profileReports));
    await fs.writeFile(path.resolve(outputHtmlFile), resultsHtml);
}


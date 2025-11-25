import { MongoClient } from 'mongodb'
import a from 'awaiting';
import chalk from 'chalk';
import util from 'util';
import { promises as fs } from "fs";
import yoctoSpinner from 'yocto-spinner';
import path from 'path';
import url from 'url';
import dayjs from 'dayjs'

class Profiler {
    
    static profilingResultsDir = path.resolve(`${path.dirname(url.fileURLToPath(import.meta.url))}/../profiling-reports`);
    static reportFolderPrefix = 'REPORT_';
    static profileFilePrefix = 'PROFILE_';
    static profilingSessionInfoFile = '_PROFILER_CONFIG_.json';


    constructor(mongoConnectionUrl, opts) {
        this.mongoConnectionUrl = mongoConnectionUrl;
        this.opts = opts;
    }

    async getDb() {
        const connectionOptions = {
            directConnection: true,
            connectTimeoutMS: 20000,
        }
        if (this.opts.duration) {
            connectionOptions.maxIdleTimeMS = this.opts.duration * 60 * 1000 + 5000;
        }
        const mongo = new MongoClient(
            this.mongoConnectionUrl, 
            connectionOptions
        );
        await mongo.connect();
        return mongo;
    }

    async run() {
        let databasesNames = [];

        console.log(`Connecting MongoDB instance ${this.mongoConnectionUrl}`);
        const mongo = await this.getDb();

        databasesNames = await this.getDatabaseslist();
        console.log(`Found ${databasesNames.length} databases`);
        
        if (databasesNames.length == 0) {
            throw Error(`There are no databases on this MongoDB instance ${this.mongoConnectionUrl}`);
        }

        const profilingStart = dayjs();

        let parallelDbs;
        let profilingSpinner;
        if (this.opts.databasesParallel == 0) {
            parallelDbs = databasesNames.length;
            profilingSpinner = yoctoSpinner({text: `Profiling databases (all ${databasesNames.length} in parallel)`}).start();
        } else {
            parallelDbs = this.opts.databasesParallel;
            profilingSpinner = yoctoSpinner({text: `Profiling databases (batch size: ${this.opts.databasesParallel})`}).start();
        }

        try {
            // profile dbs
            const profilingResult = await a.map(
                databasesNames, 
                parallelDbs, 
                async (dbName) => {
                    return this._profileDb(dbName);
                }
            );

            // prepare reports storage
            const sessionDir = `${Profiler.profilingResultsDir}/${Profiler.reportFolderPrefix}` + profilingStart.format('YYYYMMDD_hh_mm_ss');

            await fs.mkdir(Profiler.profilingResultsDir, { recursive: true });
            await fs.mkdir(sessionDir, { recursive: true });
            
            // add profile config file
            await fs.writeFile(
                `${sessionDir}/${Profiler.profilingSessionInfoFile}`, 
                JSON.stringify({
                    ...this.getProfilingConfig().asObject,
                    profilingStart: profilingStart.unix()
                })
            );

            // save profiles for each db
            for (const profilingResultItem of profilingResult) {
                const dbName = profilingResultItem.database;
                await fs.writeFile(
                    `${sessionDir}/${Profiler.profileFilePrefix}${dbName}.json`, 
                    JSON.stringify(profilingResultItem.records, null, 4)
                );
            }
            

            profilingSpinner.success(`Profiling finished`);
            return profilingResult;
        } catch (e) {
            profilingSpinner.error(`Profiling error: ${e.message}`);
            throw e;
        }
    }

    getProfilingConfig() {
        const dbList = (this.opts.databases == 'all' ? 'all': this.opts.databases.join(', '));

        const asObject = {
            slowms: this.opts.slowms,
            dbList: dbList,
            profileSizeMB: this.opts.maxProfileSize,
            durationMin: this.opts.duration,
        }

        const asText = `Profiling queries slower than ${asObject.slowms}ms for ${asObject.durationMin} minute(s) \
for databases: "${asObject.dbList}". Profile size set to ${asObject.profileSizeMB}MB`;

        return {
            asObject: asObject,
            asText: asText
        };
    }

    async getDatabaseslist() {
        const mongo = await this.getDb();

        const result = await mongo.db('admin').admin().listDatabases();
        const dbNames = result.databases.map((dbItem) => dbItem.name);

        if (this.opts.databases && this.opts.databases !== 'all') {
            return this.opts.databases.filter((db) => {
                const keep = dbNames.includes(db);
                if (! keep) {
                    throw Error(chalk.red(`You passed "${db}" database, but it doesn't exist on this MongoDB instance ${this.mongoConnectionUrl}. Please correct your command and try again, I would not like handling incorrect requests :)`));
                }
                return keep;
            });
        }
        return dbNames;
    }

    async _profileDb(dbName, profilesFolderName) {        

        const mongo = await this.getDb();
        let profileData = [];

        try {
            const verbose = false;
            /*
            this.opts.slowms //: 100,
            this.opts.duration //: 1,
            this.opts.maxProfileSize //: 1,
            */

            const db = mongo.db(dbName);

            if (verbose) console.log(chalk.blue(`[${dbName}] Starting profiling setup...`));

            await this.cleanup(dbName);

            // Optionally clean up previous profiling data
            const profileCollection = db.collection('system.profile');
            
            // Recreate capped system.profile collection with given max size (MB)
            if (this.opts.maxProfileSize != 1) {
                await db.createCollection(
                    'system.profile', 
                    { 
                        capped: true, 
                        size: this.opts.maxProfileSize * 1024 * 1024 
                    }
                );
                if (verbose) console.log(chalk.gray(`[${dbName}] Created capped "system.profile" with non-default size ${this.opts.maxProfileSize}MB)`));
            }

            // Enable profiler with slowms filter
            // off, slow_only, all
            await db.command({ profile: 1, slowms: this.opts.slowms });
            
            if (verbose) console.log(chalk.gray(`[${dbName}] Profiling enabled (slowms: ${this.opts.slowms}ms).`));

            // Wait for profiling ("this.opts.duration" seconds)
            if (verbose) console.log(chalk.gray(`[${dbName}] Waiting ${this.opts.duration} minute(s) for profiling...`));
            await a.delay(this.opts.duration * 60 * 1000);

            // Get profiling data
            profileData = await profileCollection.find().toArray();
            
            if (verbose) console.log(chalk.gray(`[${dbName}] Filtered down to ${profileData.length} profiling records.`));

            // Disable profiler after waiting
            await db.command({ profile: 0 });

            if (verbose) console.log(chalk.gray(`[${dbName}] Profiling stopped.`));

        } finally {
            await this.cleanup(dbName);
        }

        return {
            database: dbName,
            records: profileData
        };
    }

    async cleanup(dbName) {
        const mongo = await this.getDb();

        const db = mongo.db(dbName);

        // Disable profiler
        await db.setProfilingLevel('off');

        // drop system.profile
        const profileCollection = db.collection('system.profile');
        
        try {
            await profileCollection.drop();
        } catch (e) {
            // ignore error in case collection doesn't exist or throw otherwise
            if (! e.message.includes('ns not found')) {
                throw e;
            }
        }
    }

    async cleanupAllDbs() {
        const databasesNames = await this.getDatabaseslist();
        
        const promises = [];
        for (const dbName of databasesNames) {
            promises.push(this.cleanup(dbName));
        }
        await Promise.all(promises);
    }
}

export default Profiler;


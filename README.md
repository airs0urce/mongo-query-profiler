I’m currently looking for a new role in backend and front-end engineering. Node.js, MongoDB, Vue, etc.
Open to remote full-time or long-term contract work — including compensation in crypto. 
Feel free to reach out.
  
CV: <a href="https://drive.google.com/file/d/1afd9T1rpAua0hPcRQUeg0QG4BSLqqjPX/view?usp=sharing">https://drive.google.com/file/d/1afd9T1rpAua0hPcRQUeg0QG4BSLqqjPX/view?usp=sharing</a>
<br/>LinkedIn: <a href="https://www.linkedin.com/in/dmitry-eroshenko">https://www.linkedin.com/in/dmitry-eroshenko</a>
<br/>Telegram: <a href="https://t.me/airs0urce">@airs0urce</a>
<br/>Email: airs0urce0@gmail.com

<img src="https://github.com/user-attachments/assets/e86372f7-29a4-4bc3-822e-4dd35e38c006" width="300" height="300" align="right" />

# Mongo Query Profiler

Command‑line helper that collects slow query samples and converts them into an interactive HTML report so you can spot bottlenecks quickly.

This is an simple tool which doesn't require any initial setup, for long-term usage you can consider Percona Monitoring And Management for MongoDB:
<https://www.percona.com/software/database-tools/percona-monitoring-and-management/mongodb-monitoring>

## Contents
- [Quick Start](#quick-start)
  - [Install from NPM](#install-from-npm)
  - [Run using NPX](#run-using-npx)
  - [Run from cloned source code](#run-from-cloned-source-code)
- [Typical workflow](#typical-workflow)
- [CLI Commands & Examples](#cli-commands--examples)
  - [collect — capture slow queries](#collect--capture-slow-queries)
  - [report — build the HTML dashboard](#report--build-the-html-dashboard)
  - [cleanup-mongodb — disable profiler and deletes profiles in each database](#cleanup-mongodb--disable-profiler-and-deletes-profiles-in-each-database)
  - [cleanup-reports — delete local artifacts](#cleanup-reports--delete-local-artifacts)
  - [When You Find a Slow Query](#when-you-find-a-slow-query)
- [Optimization Reading List](#optimization-reading-list)
- [Connecting Through an SSH Tunnel](#connecting-through-an-ssh-tunnel)
  - [Terminal example](#terminal-example)
  - [GUI helpers](#gui-helpers)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Quick Start

### Install from NPM
1. Install Node.js: https://nodejs.org/ 
2. Install package globally `npm install -g mongo-query-profiler`
3. Run commands `mongo-query-profiler --help`

### Run using NPX

1. Install Node.js: https://nodejs.org/ 
2. Run using npx: `npx mongo-query-profiler --help`

### Run from cloned source code
2. Install Node.js: https://nodejs.org/ 
1. Clone repo: `git clone https://github.com/airs0urce/mongo-query-profiler.git && cd mongo-query-profiler`
3. Install dependencies: `npm install`
4. Install package globally: `npm install -g`
5. Run commands: `mongo-query-profiler --help`

## Typical workflow:

Note: If your MongoDB instance is behind a firewall or not exposed on a public port, see [Connecting Through an SSH Tunnel](#connecting-through-an-ssh-tunnel)

 1. Collect profiling data from your MongoDB instance `mongo-query-profiler collect mongodb://127.0.0.1:27017`
 2. Generate HTML report: `mongo-query-profiler report ./report.html`
 3. Open "report.html"

## CLI Commands & Examples

Every command supports `-h, --help` for details. The binary is published as `mongo-query-profiler`.

### collect — capture slow queries

Enable the profiler on one or more databases, wait for the sampling window to finish, then dump each database’s `system.profile` collection as JSON.

Syntax example:

```
npx mongo-query-profiler collect mongodb://user:pass@host:27017 \
  --slowms 50 \
  --databases sales analytics \
  --databases-parallel 1 \
  --duration 5 \
  --max-profile-size 8
```

Where "mongodb://user:pass@host:27017" is MongoDB connection string. If you don't have user/password "mongodb://host:27017".

This command will profile "sales" and "analytics" databases for 5 minutes. Profiles will be saved in `profiling-reports/REPORT_<timestamp>/`.

Key options:

- `--slowms <ms>`: only record operations slower than this threshold (default `100`)
- `--databases <names...>`: limit profiling to specific databases (default `all`)
- `--databases-parallel <n>`: throttle how many DBs are profiled simultaneously (default `0`, meaning all)
- `--duration <minutes>`: how long to keep the profiler on (default `1`)
- `--max-profile-size <MB>`: size for the capped `system.profile` collection (default `2`)

### report — build the HTML dashboard

Converts the latest raw profiles into a single HTML file.

Syntax example:

```
npx mongo-query-profiler report ./report.html
```

The command gathers profiles from `profiling-reports` folder and embeds them into one HTML file, 
so you get single self-contained interactive report, analyze it and send to other people by email/messenger etc.

### cleanup-mongodb — disable profiler and deletes profiles in each database

Stops the profiler on all databases reachable through the provided URI and drops `system.profile` collections. Handy if `collect` was interrupted.

Syntax example:

```
npx mongo-query-profiler cleanup-mongodb mongodb://user:pass@host:27017
```

### cleanup-reports — delete local artifacts

Removes every subfolder inside `profiling-reports/`, freeing disk space or prepping for a fresh capture.

Syntax example:

```
npx mongo-query-profiler cleanup-reports
```


### When You Find a Slow Query

1. Insert query in MongoDB Compass to "find" filter make sure you added all parts of query like "projection", "limit", "sort".
2. Click **Explain** in Compass to inspect the winning plan, stage latencies, and server stats.
3. Compare the `executionStats` results with the profiler sample to confirm the same pattern (blocked on IXSCAN vs COLLSCAN, high `keysExamined`, high `docsExamined`, etc.).

## Optimization Reading List

- Single Field Indexes: <https://www.mongodb.com/docs/manual/core/indexes/index-types/index-single/>
- Compound indexes: <https://www.mongodb.com/docs/manual/core/index-compound/>
- The ESR Guideline. Important to be able to make optimal compound index: <https://www.mongodb.com/docs/manual/tutorial/equality-sort-range-guideline/>
- Comparing `keysExamined` (index reads) vs `docsExamined` (slow disk reads): <https://www.mongodb.com/docs/manual/tutorial/explain-slow-queries/#evaluate-key-examination.>
- Use covered query to mitigate slow disk reads and get data from memory only: <https://www.mongodb.com/docs/manual/core/query-optimization/#covered-query>
- Whenever possible rewrite your query to use positive filters. Instead of using `$ne` or `$nin`
- How to optimize slow query with `{field: {$exists: true/false}}` filter: <https://www.mongodb.com/docs/manual/reference/operator/query/exists/#use-a-sparse-index-to-improve--exists-performance>, example: <https://www.mongodb.com/community/forums/t/exists-query-with-index-very-slow/4960/6>
- When you add an index, check if you can use Partial Index which decreases memory usage and speeds up index scans: https://www.mongodb.com/docs/manual/core/index-partial/


## Connecting Through an SSH Tunnel

If your MongoDB server is only reachable inside a private network, create an SSH tunnel and point the profiler to the local forwarded port.

### Terminal example

```
ssh -N -L 27018:127.0.0.1:27017 ops@bastion.example.com
```

- `-L 27018:127.0.0.1:27017` forwards local port `27018` to the remote MongoDB running on the bastion’s `127.0.0.1:27017`
- `-N` keeps the tunnel open without running a remote shell

Then run `mongo-query-profiler collect mongodb://localhost:27018`.

### GUI helpers

- macOS: [Core Tunnel](https://github.com/auroraapp/Core-Tunnel) simplifies saved tunnels and auto-reconnects
- Windows: [PuTTY](https://www.chiark.greenend.org.uk/~sgtatham/putty/) or [MobaXterm](https://mobaxterm.mobatek.net/) both support local port forwarding profiles

Whichever client you use, ensure the tunnel stays open for the entire profiling window defined by `--duration`.

## Best Practices

- Turn on profiling in production sparingly; use `--databases-parallel` to limit concurrent load.
- Keep `--duration` as short as possible while still capturing representative load spikes.
- After tuning queries/indexes, use Compass Explain to confirm changes helped.

## Troubleshooting

  - In MongoDB sharded clusters, connect directly to the shards rather than the mongos router, since profiler data on mongos will not provide useful information.
  - If your reports are empty, increase the --duration or lower the --slowms value so the profiler can capture enough events.



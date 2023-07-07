// Imports
const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs');
const AdmZip = require('adm-zip');
const { parse } = require('csv-parse');
const { stringify } = require('csv-stringify/sync');
const assert = require('assert');

// Settings
const TEMP_DIRECTORY_PATH = '/app/temp/';
const OUTPUT_DIRECTORY_PATH = '/app/output/';
const OUTPUT_ARCHIVE_FILENAME = 'CarrisMetropolitana.zip';
const DEFAULT_COMMIT_MESSAGE = 'Atualização Automática';
const DEFAULT_AGENCY_ID = 'CM';

async function init() {
  try {
    console.log();
    console.log('→ Starting GTFS Regional Merge');

    //

    console.log();
    console.log('→ Preparing variables...');

    const token = core.getInput('token');
    const octokit = github.getOctokit(token);
    const repositoryPath = process.env.GITHUB_WORKSPACE;
    const filesToMerge_string = core.getInput('files-to-merge');
    const filesToMerge_array = filesToMerge_string.split(',');
    const gtfsCommonFilesDirectoryName = core.getInput('gtfs-common-files-directory');

    // Define the column headers for each GTFS file.
    // Columns headers starting with an asterisk * will have a prefix added to every row.
    const header_Municipalities = ['municipality_prefix', 'municipality_id', 'municipality_name', 'district_id', 'district_name', 'region_id', 'region_name'];
    const header_Agency = ['agency_id', 'agency_name', 'agency_url', 'agency_timezone', 'agency_lang', 'agency_phone'];
    const header_CalendarDates = ['*service_id', 'date', 'holiday', 'period', 'day_type', 'exception_type'];
    const header_FareAttributes = ['fare_id', 'fare_short_name', 'fare_long_name', 'price', 'currency_type', 'payment_method', 'transfers', 'agency_id'];
    const header_FareRules = ['fare_id', 'route_id'];
    const header_FeedInfo = ['feed_publisher_name', 'feed_publisher_url', 'feed_lang', 'default_lang', 'feed_contact_url', 'feed_version'];
    const header_Routes = ['route_id', 'agency_id', 'route_short_name', 'route_long_name', 'route_type', 'route_color', 'route_text_color', 'circular', 'path_type'];
    const header_Shapes = ['*shape_id', 'shape_pt_lat', 'shape_pt_lon', 'shape_pt_sequence', 'shape_dist_traveled'];
    const header_StopTimes = ['*trip_id', 'arrival_time', 'departure_time', 'stop_id', 'stop_sequence', 'shape_dist_traveled', 'pickup_type', 'drop_off_type'];
    const header_Trips = ['route_id', 'pattern_id', '*service_id', '*trip_id', 'trip_headsign', 'direction_id', '*shape_id', 'calendar_desc'];
    const header_Stops = [
      'stop_id',
      'stop_code',
      'stop_name',
      'stop_short_name',
      'tts_stop_name',
      'stop_lat',
      'stop_lon',
      'locality',
      'parish_id',
      'parish_name',
      'municipality_id',
      'municipality_name',
      'district_id',
      'district_name',
      'region_id',
      'region_name',
      'near_health_clinic',
      'near_hospital',
      'near_university',
      'near_school',
      'near_police_station',
      'near_fire_station',
      'near_shopping',
      'near_historic_building',
      'near_transit_office',
      'light_rail',
      'subway',
      'train',
      'boat',
      'airport',
      'bike_sharing',
      'bike_parking',
      'car_parking',
    ];

    console.log('✔︎ Prepared variables successfully.');

    //

    console.log();
    console.log('→ Creating output directory...');
    fs.mkdirSync(OUTPUT_DIRECTORY_PATH);
    console.log('✔︎ Created output directory successfully.');

    console.log();
    console.log('→ Creating output files...');
    createOutputFile('municipalities.txt', header_Municipalities);
    createOutputFile('agency.txt', header_Agency);
    createOutputFile('calendar_dates.txt', header_CalendarDates);
    createOutputFile('fare_attributes.txt', header_FareAttributes);
    createOutputFile('fare_rules.txt', header_FareRules);
    createOutputFile('feed_info.txt', header_FeedInfo);
    createOutputFile('routes.txt', header_Routes);
    createOutputFile('shapes.txt', header_Shapes);
    createOutputFile('stop_times.txt', header_StopTimes);
    createOutputFile('trips.txt', header_Trips);
    createOutputFile('stops.txt', header_Stops);
    console.log('✔︎ Created all output files successfully.');

    //

    console.log();
    console.log(`→ Importing common-data files...`);
    await importFile(`${repositoryPath}/${gtfsCommonFilesDirectoryName}/`, 'municipalities.txt', header_Municipalities);
    await importFile(`${repositoryPath}/${gtfsCommonFilesDirectoryName}/`, 'agency.txt', header_Agency);
    await importFile(`${repositoryPath}/${gtfsCommonFilesDirectoryName}/`, 'fare_attributes.txt', header_FareAttributes);
    await importFile(`${repositoryPath}/${gtfsCommonFilesDirectoryName}/`, 'fare_rules.txt', header_FareRules);
    await importFile(`${repositoryPath}/${gtfsCommonFilesDirectoryName}/`, 'feed_info.txt', header_FeedInfo);
    await importFile(`${repositoryPath}/${gtfsCommonFilesDirectoryName}/`, 'stops.txt', header_Stops);
    console.log('✔︎ Parsed all common-data files successfully.');

    //

    // Iterate on each file path
    for await (const [index, fileName] of filesToMerge_array.entries()) {
      //

      // Define a prefix that will be used on entity IDs,
      // to avoid duplicate entries in the merged files.
      const prefix = `p${index}_`;

      console.log();
      console.log(`→ Importing archive "${fileName}" with prefix "${prefix}"...`);

      console.log('⤷ Creating temporary directory...');
      fs.mkdirSync(TEMP_DIRECTORY_PATH);
      console.log('✔︎ Created temporary directory successfully.');

      console.log('⤷ Extracting zip file...');
      const tempZip = new AdmZip(`${repositoryPath}/${fileName}`);
      tempZip.extractAllTo(TEMP_DIRECTORY_PATH, true, false); // overwrite = true; keepPermissions = false
      console.log(`✔︎ Extracted file to "${TEMP_DIRECTORY_PATH}" successfully.`);

      console.log('⤷ Importing GTFS files...');
      await importFile(TEMP_DIRECTORY_PATH, 'calendar_dates.txt', header_CalendarDates, prefix);
      await importFile(TEMP_DIRECTORY_PATH, 'routes.txt', header_Routes, prefix);
      await importFile(TEMP_DIRECTORY_PATH, 'shapes.txt', header_Shapes, prefix);
      await importFile(TEMP_DIRECTORY_PATH, 'stop_times.txt', header_StopTimes, prefix);
      await importFile(TEMP_DIRECTORY_PATH, 'trips.txt', header_Trips, prefix);
      console.log('✔︎ Parsed all GTFS files successfully.');

      console.log('⤷ Removing temporary directory...');
      fs.rmSync(TEMP_DIRECTORY_PATH, { recursive: true, force: true });
      console.log('✔︎ Removed temporary directory successfully.');

      //
    }

    //

    console.log();
    console.log('→ Archiving output files...');
    const outputZip = new AdmZip();
    outputZip.addLocalFile(OUTPUT_DIRECTORY_PATH + 'municipalities.txt');
    outputZip.addLocalFile(OUTPUT_DIRECTORY_PATH + 'agency.txt');
    outputZip.addLocalFile(OUTPUT_DIRECTORY_PATH + 'calendar_dates.txt');
    outputZip.addLocalFile(OUTPUT_DIRECTORY_PATH + 'fare_attributes.txt');
    outputZip.addLocalFile(OUTPUT_DIRECTORY_PATH + 'fare_rules.txt');
    outputZip.addLocalFile(OUTPUT_DIRECTORY_PATH + 'feed_info.txt');
    outputZip.addLocalFile(OUTPUT_DIRECTORY_PATH + 'routes.txt');
    outputZip.addLocalFile(OUTPUT_DIRECTORY_PATH + 'shapes.txt');
    outputZip.addLocalFile(OUTPUT_DIRECTORY_PATH + 'stop_times.txt');
    outputZip.addLocalFile(OUTPUT_DIRECTORY_PATH + 'trips.txt');
    outputZip.addLocalFile(OUTPUT_DIRECTORY_PATH + 'stops.txt');
    outputZip.writeZip(OUTPUT_DIRECTORY_PATH + 'regional-merge.zip');
    console.log('✔︎ Archived all output files successfully.');

    //

    console.log();
    console.log('→ Pushing changes to GitHub...');

    console.log('⤷ Fetching repository information...');
    const { data: contents } = await octokit.rest.repos.getContent({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      path: OUTPUT_ARCHIVE_FILENAME,
    });

    console.log('⤷ Fetching last commit message...');
    const commits = await octokit.rest.repos.listCommits({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      commit_sha: github.context.repo.sha,
    });

    console.log('⤷ Reading output archive from disk...');
    const fileContent = fs.readFileSync(OUTPUT_DIRECTORY_PATH + 'regional-merge.zip', { encoding: 'base64' });

    console.log('⤷ Commiting latest changes to GitHub...');
    await octokit.rest.repos.createOrUpdateFileContents({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      path: OUTPUT_ARCHIVE_FILENAME,
      message: commits.data[0].commit.message || DEFAULT_COMMIT_MESSAGE,
      content: fileContent.toString(),
      sha: contents.sha,
    });
    console.log('✔︎ Pushed changes to GitHub successfully.');

    console.log();
    console.log('■ Done :)');

    //
  } catch (error) {
    console.log();
    console.log('✖︎ An error occurred:', error);
    core.setFailed(error.message);
  }
}

// Create Output File
const createOutputFile = (filename, headers) => {
  const headersString = headers.join(',').replace(/\*/g, '');
  fs.writeFileSync(OUTPUT_DIRECTORY_PATH + filename, headersString + '\n');
  console.log(`⤷ Created file "${OUTPUT_DIRECTORY_PATH + filename}" successfully.`);
};

async function importFile(filepath, filename, headers, prefix = '') {
  console.log(`⤷ Importing "${filepath}${filename}" to output file...`);
  const parserStream = fs.createReadStream(filepath + filename).pipe(parse({ columns: true, trim: true, skip_empty_lines: true, ignore_last_delimiters: true, bom: true }));
  let counter = 0;
  for await (const rowObject of parserStream) {
    counter++;
    let rowArray = [];
    for (const key of headers) {
      let colString = '';

      // Include the feed version as the current date in YYYYMMDDHHMMSS.
      if (key === 'feed_version') {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        colString = `${year}${month}${day}${hours}${minutes}${seconds}`;
      }

      // If the current header starts with an asterisk then it means it should add the prefix
      // to the cell value for the given row-column combination.
      else if (key.startsWith('*')) {
        const realKey = key.replace(/\*/g, '');
        colString = prefix + rowObject[realKey];
      }

      // If the current header is 'agency_id'
      // then the cell should be the global constant.
      else if (key === 'agency_id') {
        colString = DEFAULT_AGENCY_ID;
      }

      // If the current header is 'route_short_name'
      // then check if the cell value is numeric and if it is exactly 4 characters.
      //   else if (key === 'route_short_name') {
      //     assert(!isNaN(rowObject[key]), `Column 'route_short_name' in ${filename} is not numeric. Value is "${rowObject[key]}" on row ${counter}.`);
      //     assert(rowObject[key].length === 4, `Column 'route_short_name' in ${filename} is not 4 characters. Value is "${rowObject[key]}" on row ${counter}.`);
      //     colString = rowObject[key];
      //   }

      // If the current header is 'route_color' or 'route_text_color'
      // then check if the cell value is exactly 6 characters.
      else if (key === 'route_color' || key === 'route_text_color') {
        assert(rowObject[key].length === 6, `Column 'route_color' or 'route_text_color' in ${filename} is not 6 characters. Value is "${rowObject[key]}" on row ${counter}.`);
        colString = rowObject[key];
      }

      // If the current header did not match any previous conditions,
      // then just add the current cell value.
      else {
        colString = rowObject[key];
      }

      rowArray.push(colString);
    }
    const rowString = stringify([rowArray], { trim: true });
    fs.appendFileSync(OUTPUT_DIRECTORY_PATH + filename, rowString);
  }
  console.log(`✔︎ Imported ${counter} rows to output "${filename}" successfully`);
}

// Start here
init();

/*
*
* Usage -- see README.md
*
* Normal usage:                node bin/plugins/checkPlugins.js ep_whatever
* Auto fix the things it can:  node bin/plugins/checkPlugins.js ep_whatever autofix
* Auto commit, push and publish(to npm) * highly dangerous:
node bin/plugins/checkPlugins.js ep_whatever autofix autocommit

*/

const fs = require("fs");
const { exec } = require("child_process");

// get plugin name & path from user input
const pluginName = process.argv[2];

if(!pluginName){
  console.error("no plugin name specified");
  process.exit(1);
}

const pluginPath = "node_modules/"+pluginName;

console.log("Checking the plugin: "+ pluginName)

// Should we autofix?
if (process.argv[3] && process.argv[3] === "autofix") var autoFix = true;

// Should we update files where possible?
if (process.argv[5] && process.argv[5] === "autoupdate") var autoUpdate = true;

// Should we automcommit and npm publish?!
if (process.argv[4] && process.argv[4] === "autocommit") var autoCommit = true;


if(autoCommit){
  console.warn("Auto commit is enabled, I hope you know what you are doing...")
}

fs.readdir(pluginPath, function (err, rootFiles) {
  //handling error
  if (err) {
    return console.log('Unable to scan directory: ' + err);
  }

  // rewriting files to lower case
  var files = [];

  // some files we need to know the actual file name.  Not compulsory but might help in the future.
  var readMeFileName;
  var repository;
  var hasAutofixed = false;

  for (var i = 0; i < rootFiles.length; i++) {
    if(rootFiles[i].toLowerCase().indexOf("readme") !== -1) readMeFileName = rootFiles[i];
    files.push(rootFiles[i].toLowerCase());
  }

  if(files.indexOf(".git") === -1){
    console.error("No .git folder, aborting");
    process.exit(1);
  }

  // do a git pull...
  var child_process = require('child_process');
  try{
    child_process.execSync('git pull ',{"cwd":pluginPath+"/"});
  }catch(e){
    console.error("Error git pull", e);
  };

  try {
    const path = pluginPath + '/.github/workflows/npmpublish.yml';
    if (!fs.existsSync(path)) {
      console.log('no .github/workflows/npmpublish.yml, create one and set npm secret to auto publish to npm on commit');
      if (autoFix) {
        const npmpublish =
            fs.readFileSync('bin/plugins/lib/npmpublish.yml', {encoding: 'utf8', flag: 'r'});
        fs.mkdirSync(pluginPath + '/.github/workflows', {recursive: true});
        fs.writeFileSync(path, npmpublish);
        console.log("If you haven't already, setup autopublish for this plugin https://github.com/ether/etherpad-lite/wiki/Plugins:-Automatically-publishing-to-npm-on-commit-to-Github-Repo");
      } else {
        console.log('Setup autopublish for this plugin https://github.com/ether/etherpad-lite/wiki/Plugins:-Automatically-publishing-to-npm-on-commit-to-Github-Repo');
      }
    }
  } catch (err) {
    console.error(err);
  }

  if(files.indexOf("package.json") === -1){
    console.warn("no package.json, please create");
  }

  if(files.indexOf("package.json") !== -1){
    let packageJSON = fs.readFileSync(pluginPath+"/package.json", {encoding:'utf8', flag:'r'});
    let parsedPackageJSON = JSON.parse(packageJSON);
    if(autoFix){
      var updatedPackageJSON = false;
      if(!parsedPackageJSON.funding){
        updatedPackageJSON = true;
        parsedPackageJSON.funding = {
          "type": "individual",
          "url": "http://etherpad.org/"
        }
      }
      if(updatedPackageJSON){
        hasAutofixed = true;
        fs.writeFileSync(pluginPath+"/package.json", JSON.stringify(parsedPackageJSON, null, 2));
      }
    }

    if(packageJSON.toLowerCase().indexOf("repository") === -1){
      console.warn("No repository in package.json");
      if(autoFix){
        console.warn("Repository not detected in package.json.  Please add repository section manually.")
      }
    }else{
      // useful for creating README later.
      repository = parsedPackageJSON.repository.url;
    }

  }

  if(files.indexOf("package-lock.json") === -1){
    console.warn("package-lock.json file not found.  Please run npm install in the plugin folder and commit the package-lock.json file.")
    if(autoFix){
      var child_process = require('child_process');
      try{
        child_process.execSync('npm install',{"cwd":pluginPath+"/"});
        console.log("Making package-lock.json");
        hasAutofixed = true;
      }catch(e){
        console.error("Failed to create package-lock.json");
      }
    }
  }

  if(files.indexOf("readme") === -1 && files.indexOf("readme.md") === -1){
    console.warn("README.md file not found, please create");
    if(autoFix){
      console.log("Autofixing missing README.md file, please edit the README.md file further to include plugin specific details.");
      let readme = fs.readFileSync("bin/plugins/lib/README.md", {encoding:'utf8', flag:'r'})
      readme = readme.replace(/\[plugin_name\]/g, pluginName);
      if(repository){
        let org = repository.split("/")[3];
        let name = repository.split("/")[4];
        readme = readme.replace(/\[org_name\]/g, org);
        readme = readme.replace(/\[repo_url\]/g, name);
        fs.writeFileSync(pluginPath+"/README.md", readme);
      }else{
        console.warn("Unable to find repository in package.json, aborting.")
      }
    }
  }

  if(files.indexOf("readme") !== -1 && files.indexOf("readme.md") !== -1){
    let readme = fs.readFileSync(pluginPath+"/"+readMeFileName, {encoding:'utf8', flag:'r'});
    if(readme.toLowerCase().indexOf("license") === -1){
      console.warn("No license section in README");
      if(autoFix){
        console.warn("Please add License section to README manually.")
      }
    }
  }

  if(files.indexOf("license") === -1 && files.indexOf("license.md") === -1){
    console.warn("LICENSE.md file not found, please create");
    if(autoFix){
      hasAutofixed = true;
      console.log("Autofixing missing LICENSE.md file, including Apache 2 license.");
      exec("git config user.name", (error, name, stderr) => {
        if (error) {
          console.log(`error: ${error.message}`);
          return;
        }
        if (stderr) {
          console.log(`stderr: ${stderr}`);
          return;
        }
        let license = fs.readFileSync("bin/plugins/lib/LICENSE.md", {encoding:'utf8', flag:'r'});
        license = license.replace("[yyyy]", new Date().getFullYear());
        license = license.replace("[name of copyright owner]", name)
        fs.writeFileSync(pluginPath+"/LICENSE.md", license);
      });
    }
  }

  var travisConfig = fs.readFileSync("bin/plugins/lib/travis.yml", {encoding:'utf8', flag:'r'});
  travisConfig = travisConfig.replace(/\[plugin_name\]/g, pluginName);

  if(files.indexOf(".travis.yml") === -1){
    console.warn(".travis.yml file not found, please create.  .travis.yml is used for automatically CI testing Etherpad.  It is useful to know if your plugin breaks another feature for example.")
    // TODO: Make it check version of the .travis file to see if it needs an update.
    if(autoFix){
      hasAutofixed = true;
      console.log("Autofixing missing .travis.yml file");
      fs.writeFileSync(pluginPath+"/.travis.yml", travisConfig);
      console.log("Travis file created, please sign into travis and enable this repository")
    }
  }
  if(autoFix && autoUpdate){
    // checks the file versioning of .travis and updates it to the latest.
    let existingConfig = fs.readFileSync(pluginPath + "/.travis.yml", {encoding:'utf8', flag:'r'});
    let existingConfigLocation = existingConfig.indexOf("##ETHERPAD_TRAVIS_V=");
    let existingValue = parseInt(existingConfig.substr(existingConfigLocation+20, existingConfig.length));

    let newConfigLocation = travisConfig.indexOf("##ETHERPAD_TRAVIS_V=");
    let newValue = parseInt(travisConfig.substr(newConfigLocation+20, travisConfig.length));
    if(existingConfigLocation === -1){
      console.warn("no previous .travis.yml version found so writing new.")
      // we will write the newTravisConfig to the location.
      fs.writeFileSync(pluginPath + "/.travis.yml", travisConfig);
    }else{
      if(newValue > existingValue){
        console.log("updating .travis.yml");
        fs.writeFileSync(pluginPath + "/.travis.yml", travisConfig);
        hasAutofixed = true;
      }
    }
  }

  if(files.indexOf(".gitignore") === -1){
    console.warn(".gitignore file not found, please create.  .gitignore files are useful to ensure files aren't incorrectly commited to a repository.")
    if(autoFix){
      hasAutofixed = true;
      console.log("Autofixing missing .gitignore file");
      let gitignore = fs.readFileSync("bin/plugins/lib/gitignore", {encoding:'utf8', flag:'r'});
      fs.writeFileSync(pluginPath+"/.gitignore", gitignore);
    }
  }

  // if we include templates but don't have translations...
  if(files.indexOf("templates") !== -1 && files.indexOf("locales") === -1){
    console.warn("Translations not found, please create.  Translation files help with Etherpad accessibility.");
  }


  if(files.indexOf(".ep_initialized") !== -1){
    console.warn(".ep_initialized found, please remove.  .ep_initialized should never be commited to git and should only exist once the plugin has been executed one time.")
    if(autoFix){
      hasAutofixed = true;
      console.log("Autofixing incorrectly existing .ep_initialized file");
      fs.unlinkSync(pluginPath+"/.ep_initialized");
    }
  }

  if(files.indexOf("npm-debug.log") !== -1){
    console.warn("npm-debug.log found, please remove.  npm-debug.log should never be commited to your repository.")
    if(autoFix){
      hasAutofixed = true;
      console.log("Autofixing incorrectly existing npm-debug.log file");
      fs.unlinkSync(pluginPath+"/npm-debug.log");
    }
  }

  if(files.indexOf("static") !== -1){
    fs.readdir(pluginPath+"/static", function (errRead, staticFiles) {
      if(staticFiles.indexOf("tests") === -1){
        console.warn("Test files not found, please create tests.  https://github.com/ether/etherpad-lite/wiki/Creating-a-plugin#writing-and-running-front-end-tests-for-your-plugin")
      }
    })
  }else{
    console.warn("Test files not found, please create tests.  https://github.com/ether/etherpad-lite/wiki/Creating-a-plugin#writing-and-running-front-end-tests-for-your-plugin")
  }

  if(hasAutofixed){
    console.log("Fixes applied, please check git diff then run the following command:\n\n")
    // bump npm Version
    if(autoCommit){
      // holy shit you brave.
      console.log("Attempting autocommit and auto publish to npm")
      // github should push to npm for us :)
      exec("cd node_modules/"+ pluginName + " && git add -A && git commit --allow-empty -m 'autofixes from Etherpad checkPlugins.js' && git push && cd ../..", (error, name, stderr) => {
        if (error) {
          console.log(`error: ${error.message}`);
          return;
        }
        if (stderr) {
          console.log(`stderr: ${stderr}`);
          return;
        }
        console.log("I think she's got it! By George she's got it!")
        process.exit(0)
      });
    }else{
      console.log("cd node_modules/"+ pluginName + " && git add -A && git commit --allow-empty -m 'autofixes from Etherpad checkPlugins.js' && npm version patch && git add package.json && git commit --allow-empty -m 'bump version' && git push && npm publish && cd ../..")
    }
  }

  console.log("Finished");

});

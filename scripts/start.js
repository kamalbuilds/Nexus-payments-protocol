'use strict';

// Do this as the first thing so that any code reading it knows the right env.
process.env.BABEL_ENV = 'development';
process.env.NODE_ENV = 'development';

// Makes the script crash on unhandled rejections instead of silently
// ignoring them. In the future, promise rejections that are not handled will
// terminate the Node.js process with a non-zero exit code.
process.on('unhandledRejection', err => {
  throw err;
});

const fs = require('fs');
const chalk = require('react-dev-utils/chalk');
const webpack = require('webpack');
const WebpackDevServer = require('webpack-dev-server');
const clearConsole = require('react-dev-utils/clearConsole');
const checkRequiredFiles = require('react-dev-utils/checkRequiredFiles');
const {
  choosePort,
  createCompiler,
  prepareProxy,
  prepareUrls
} = require('react-dev-utils/WebpackDevServerUtils');
const openBrowser = require('react-dev-utils/openBrowser');
const paths = require('../config/paths');
const configFactory = require('../config/webpack.config');
const createDevServerConfig = require('../config/webpackDevServer.config');
const {spawn} = require('child_process');
const {getNetworkName, setupGanache, configureEnvVariables} = require('@statechannels/devtools');
const {deploy} = require('../deployment/deploy');

// Do this as the first thing so that any code reading it knows the right env.
process.env.BABEL_ENV = 'development';
process.env.NODE_ENV = 'development';

let devServer;
let trackerServer;

// Makes the script crash on unhandled rejections instead of silently
// ignoring them. In the future, promise rejections that are not handled will
// terminate the Node.js process with a non-zero exit code.
process.on('unhandledRejection', err => {
  if (devServer) {
    devServer.close();
  }
  if (trackerServer) {
    trackerServer.kill();
  }
  throw err;
});

// Ensure environment variables are read.
configureEnvVariables();

void (async () => {
  process.on('SIGINT', () => {
    if (devServer) {
      devServer.close();
    }
    if (trackerServer) {
      trackerServer.kill();
    }
  });
  process.on('SIGTERM', () => {
    if (devServer) {
      devServer.close();
    }
    if (trackerServer) {
      trackerServer.kill();
    }
  });
  process.on('exit', () => {
    if (devServer) {
      devServer.close();
    }
    if (trackerServer) {
      trackerServer.kill();
    }
  });

  process.env.TARGET_NETWORK = getNetworkName(process.env.CHAIN_NETWORK_ID);

  if (process.env.TARGET_NETWORK === 'development') {
    // Add contract addresses to process.env if running ganache
    const {deployer} = await await setupGanache(process.env.WEB3TORRENT_DEPLOYER_ACCOUNT_INDEX);
    const deployedArtifacts = await deploy(deployer);
    process.env = {...process.env, ...deployedArtifacts};
  }
  const isInteractive = process.stdout.isTTY;

  const {checkBrowsers} = require('react-dev-utils/browsersHelper');
  await checkBrowsers(paths.appPath, isInteractive);
  const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 3000;
  const HOST = process.env.HOST || '0.0.0.0';
  const port = await choosePort(HOST, DEFAULT_PORT);
  const config = configFactory('development');
  const protocol = process.env.HTTPS === 'true' ? 'https' : 'http';
  const appName = require(paths.appPackageJson).name;
  const useTypeScript = fs.existsSync(paths.appTsConfig);
  const urls = prepareUrls(protocol, HOST, port);
  const devSocket = {
    warnings: warnings => devServer.sockWrite(devServer.sockets, 'warnings', warnings),
    errors: errors => devServer.sockWrite(devServer.sockets, 'errors', errors)
  };
  // Create a webpack compiler that is configured with custom messages.
  const compiler = createCompiler({
    appName,
    config,
    devSocket,
    urls,
    useYarn: true,
    useTypeScript,
    webpack
  });
  // Load proxy config
  const proxySetting = require(paths.appPackageJson).proxy;
  const proxyConfig = prepareProxy(proxySetting, paths.appPublic);
  // Serve webpack assets generated by the compiler over a web server.
  const serverConfig = createDevServerConfig(proxyConfig, urls.lanUrlForConfig);
  const devServer = new WebpackDevServer(compiler, serverConfig);
  devServer.listen(port, HOST, error => {
    console.error(error);
  });

  const trackerServer = spawn('yarn', ['run', 'start:tracker']);

  trackerServer.stdout.on('data', data => {
    console.log(data.toString());
  });

  trackerServer.stderr.on('data', data => {
    console.log(data.toString());
  });

  trackerServer.on('close', code => {
    process.exit(code);
  });
})();
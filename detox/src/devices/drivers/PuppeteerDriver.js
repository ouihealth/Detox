const _ = require('lodash');
const path = require('path');
const fs = require('fs');
const log = require('../../utils/logger').child({ __filename });
const DeviceDriverBase = require('./DeviceDriverBase');
const InvocationManager = require('../../invoke').InvocationManager;
const invoke = require('../../invoke');
const GREYConfigurationApi = require('../../ios/earlgreyapi/GREYConfiguration');
const GREYConfigurationDetox = require('../../ios/earlgreyapi/GREYConfigurationDetox');
const EarlyGreyImpl = require('../../ios/earlgreyapi/EarlGreyImpl');
const AppleSimUtils = require('../ios/AppleSimUtils');

const SimulatorLogPlugin = require('../../artifacts/log/ios/SimulatorLogPlugin');
const SimulatorScreenshotPlugin = require('../../artifacts/screenshot/SimulatorScreenshotPlugin');
const SimulatorRecordVideoPlugin = require('../../artifacts/video/SimulatorRecordVideoPlugin');
const SimulatorInstrumentsPlugin = require('../../artifacts/instruments/ios/SimulatorInstrumentsPlugin');
const WebExpect = require('../../web/expect');

const puppeteer = require('puppeteer');
const Client = require('../../client/Client');
const { LoginTestee } = require('../../client/actions/actions');

function debug(label, ...args) {
  console.log(`PuppeteerDriver.${label}`, ...args);
}

let browser, page;
class PuppeteerTestee {
  constructor(config) {
    console.log('PuppeteerTestee.constructor', config);
    this.configuration = config.client.configuration;
    this.client = new Client(this.configuration);
  }

  async getElementHandle(...args) {
    console.log('getElementHandle', args);
    return await page.waitForSelector(...args);
  }

  async assertWithMatcher(...args) {
    console.log('assertWithMatcher', args);
    const result = await args[0][args[1].method]();
    if (!result) throw new Error('assertion failed');
    return result;
  }

  async invoke(params) {
    console.log({ params });
    const promises = params.args.map((arg) => {
      if (arg.type === 'Invocation') {
        return this.invoke(arg.value);
      } else if (arg.type === 'matcher') {
        return arg.selector;
      }
    });

    const args = await Promise.all(promises);
    console.log('call', params, args);
    if (params.target === 'this' || params.target.type === 'this') {
      const result = await this[params.method](...args);
      console.log('result', params.method, result);
      return result;
    }

    return params;
  }

  async connect() {
    // this.client.ws.on('error', (e) => {
    //   console.error(e);
    // });

    // this.client.ws.on('close', () => {
    //   console.log('close');
    // });

    await this.client.ws.open();
    this.client.ws.ws.on('message', async (str) => {
      try {
        const action = JSON.parse(str);
        console.log('PuppeteerTestee.message', JSON.stringify(action, null, 2));
        if (!action.type) {
          return;
        }
        if (action.type === 'loginSuccess') return;
        console.log('waitForSelector', action);
        try {
          await this.invoke(action.params);
        } catch (e) {
          browser.close();
          console.error(e);
        }
        this.client.ws.ws.send(JSON.stringify({ type: 'invokeResult', messageId: action.messageId }));
      } catch (err) {
        console.error(err);
      }
    });

    await this.client.sendAction(new LoginTestee(this.configuration.sessionId));
  }
}

class PuppeteerDriver extends DeviceDriverBase {
  constructor(config) {
    super(config);
    debug('constructor', config);

    this.matchers = new WebExpect(new InvocationManager(this.client));
    this.testee = new PuppeteerTestee(config);
  }

  declareArtifactPlugins() {
    debug('declareArtifactPlugins');
    return {};
    const appleSimUtils = this.applesimutils;
    const client = this.client;

    return {
      instruments: (api) => new SimulatorInstrumentsPlugin({ api, client }),
      log: (api) => new SimulatorLogPlugin({ api, appleSimUtils }),
      screenshot: (api) => new SimulatorScreenshotPlugin({ api, appleSimUtils }),
      video: (api) => new SimulatorRecordVideoPlugin({ api, appleSimUtils })
    };
  }

  createPayloadFile(notification) {
    const notificationFilePath = path.join(this.createRandomDirectory(), `payload.json`);
    fs.writeFileSync(notificationFilePath, JSON.stringify(notification, null, 2));
    return notificationFilePath;
  }

  async setURLBlacklist(urlList) {
    debug('TODO setURLBlacklist');
    // await this.client.execute(
    //   GREYConfigurationApi.setValueForConfigKey(
    //     invoke.callDirectly(GREYConfigurationApi.sharedInstance()),
    //     urlList,
    //     'GREYConfigKeyURLBlacklistRegex'
    //   )
    // );
  }

  async enableSynchronization() {
    await this.client.execute(GREYConfigurationDetox.enableSynchronization(invoke.callDirectly(GREYConfigurationApi.sharedInstance())));
  }

  async disableSynchronization() {
    await this.client.execute(GREYConfigurationDetox.disableSynchronization(invoke.callDirectly(GREYConfigurationApi.sharedInstance())));
  }

  async shake(deviceId) {
    return await this.client.shake();
  }

  async setOrientation(deviceId, orientation) {
    const call = EarlyGreyImpl.rotateDeviceToOrientationErrorOrNil(invoke.EarlGrey.instance, orientation);
    await this.client.execute(call);
  }

  getPlatform() {
    return 'web';
  }

  async prepare() {
    // const detoxFrameworkPath = await environment.getFrameworkPath();
    // if (!fs.existsSync(detoxFrameworkPath)) {
    //   throw new Error(`${detoxFrameworkPath} could not be found, this means either you changed a version of Xcode or Detox postinstall script was unsuccessful.
    //   To attempt a fix try running 'detox clean-framework-cache && detox build-framework-cache'`);
    // }
  }

  async cleanup(deviceId, bundleId) {
    debug('TODO cleanup', { deviceId, bundleId });
    if (browser) browser.close();
    // await this.deviceRegistry.disposeDevice(deviceId);
    await super.cleanup(deviceId, bundleId);
  }

  async acquireFreeDevice(deviceQuery) {
    debug('PuppeteerDriver.acquireFreeDevice', deviceQuery);
    return '';
    // const udid = await this.deviceRegistry.allocateDevice(async () => {
    //   return await this._findOrCreateDevice(deviceQuery);
    // });

    // const deviceComment = this._commentDevice(deviceQuery);
    // if (!udid) {
    //   throw new Error(`Failed to find device matching ${deviceComment}`);
    // }

    // await this._boot(udid);
    // this._name = `${udid} ${deviceComment}`;
    // return udid;
  }

  async getBundleIdFromBinary(appPath) {
    debug('PuppeteerDriver.getBundleIdFromBinary', appPath);
    return '';
    // try {
    //   const result = await exec(`/usr/libexec/PlistBuddy -c "Print CFBundleIdentifier" "${path.join(appPath, 'Info.plist')}"`);
    //   const bundleId = _.trim(result.stdout);
    //   if (_.isEmpty(bundleId)) {
    //     throw new Error();
    //   }
    //   return bundleId;
    // } catch (ex) {
    //   throw new Error(`field CFBundleIdentifier not found inside Info.plist of app binary at ${appPath}`);
    // }
  }

  async _boot(deviceId) {
    debug('PuppeteerDriver.boot', { deviceId, bundleId });
    const deviceLaunchArgs = argparse.getArgValue('deviceLaunchArgs');
    const coldBoot = await this.applesimutils.boot(deviceId, deviceLaunchArgs);
    await this.emitter.emit('bootDevice', { coldBoot, deviceId });
  }

  async installApp(deviceId, binaryPath) {
    debug('installApp', { deviceId, binaryPath });
    // await this.applesimutils.install(deviceId, binaryPath);
  }

  async uninstallApp(deviceId, bundleId) {
    debug('uninstallApp', { deviceId, bundleId });
    await this.emitter.emit('beforeUninstallApp', { deviceId, bundleId });
    if (browser) browser.close();
    // await this.applesimutils.uninstall(deviceId, bundleId);
  }

  async launchApp(deviceId, bundleId, launchArgs, languageAndLocale) {
    debug('launchApp', { deviceId, bundleId, launchArgs, languageAndLocale });
    await this.emitter.emit('beforeLaunchApp', { bundleId, deviceId, launchArgs });
    browser = await puppeteer.launch({ headless: false });
    if (launchArgs.detoxURLOverride) {
      page = (await browser.pages())[0];
      await page.goto(launchArgs.detoxURLOverride);
    }
    // const pid = await this.applesimutils.launch(deviceId, bundleId, launchArgs, languageAndLocale);
    const pid = 'PID';
    await this.emitter.emit('launchApp', { bundleId, deviceId, launchArgs, pid });

    return pid;
  }

  async terminate(deviceId, bundleId) {
    debug('terminate', { deviceId, bundleId });
    await this.emitter.emit('beforeTerminateApp', { deviceId, bundleId });
    if (browser) browser.close();
    // await this.applesimutils.terminate(deviceId, bundleId);
    await this.emitter.emit('terminateApp', { deviceId, bundleId });
  }

  async setBiometricEnrollment(deviceId, yesOrNo) {
    await this.applesimutils.setBiometricEnrollment(deviceId, yesOrNo);
  }

  async matchFace(deviceId) {
    await this.applesimutils.matchBiometric(deviceId, 'Face');
  }

  async unmatchFace(deviceId) {
    await this.applesimutils.unmatchBiometric(deviceId, 'Face');
  }

  async matchFinger(deviceId) {
    await this.applesimutils.matchBiometric(deviceId, 'Finger');
  }

  async unmatchFinger(deviceId) {
    await this.applesimutils.unmatchBiometric(deviceId, 'Finger');
  }

  async sendToHome(deviceId) {
    await this.applesimutils.sendToHome(deviceId);
  }

  async shutdown(deviceId) {
    await this.emitter.emit('beforeShutdownDevice', { deviceId });
    await this.applesimutils.shutdown(deviceId);
    await this.emitter.emit('shutdownDevice', { deviceId });
  }

  async setLocation(deviceId, lat, lon) {
    await this.applesimutils.setLocation(deviceId, lat, lon);
  }

  async setPermissions(deviceId, bundleId, permissions) {
    debug('TODO setPermissions', { deviceId, bundleId });
  }

  async clearKeychain(deviceId) {
    await this.applesimutils.clearKeychain(deviceId);
  }

  async resetContentAndSettings(deviceId) {
    await this.shutdown(deviceId);
    await this.applesimutils.resetContentAndSettings(deviceId);
    await this._boot(deviceId);
  }

  validateDeviceConfig(deviceConfig) {
    debug('validateDeviceConfig', deviceConfig);
    if (!deviceConfig.baseUrl) {
      console.error('PuppeteerDriver requires baseUrl to be set in detox config');
      configuration.throwOnEmptyBinaryPath();
    }
  }

  getLogsPaths(deviceId) {
    return this.applesimutils.getLogsPaths(deviceId);
  }

  async waitForBackground() {
    return await this.client.waitForBackground();
  }

  async takeScreenshot(udid, screenshotName) {
    const tempPath = await temporaryPath.for.png();
    await this.applesimutils.takeScreenshot(udid, tempPath);

    await this.emitter.emit('createExternalArtifact', {
      pluginId: 'screenshot',
      artifactName: screenshotName,
      artifactPath: tempPath
    });

    return tempPath;
  }

  /***
   * @private
   * @param {String | Object} rawDeviceQuery
   * @returns {Promise<String>}
   */
  async _findOrCreateDevice(rawDeviceQuery) {
    let udid;

    const deviceQuery = this._adaptQuery(rawDeviceQuery);
    const { free, busy } = await this._groupDevicesByStatus(deviceQuery);

    if (_.isEmpty(free)) {
      const prototypeDevice = busy[0];
      udid = this.applesimutils.create(prototypeDevice);
    } else {
      udid = free[0].udid;
    }

    return udid;
  }

  async _groupDevicesByStatus(deviceQuery) {
    const searchResults = await this._queryDevices(deviceQuery);

    const { busy, free } = _.groupBy(searchResults, (device) => {
      return this.deviceRegistry.isDeviceBusy(device.udid) ? 'busy' : 'free';
    });

    const targetOS = _.get(busy, '0.os.identifier');
    const isMatching = targetOS && { os: { identifier: targetOS } };

    return {
      busy: _.filter(busy, isMatching),
      free: _.filter(free, isMatching)
    };
  }

  async _queryDevices(deviceQuery) {
    const result = await this.applesimutils.list(deviceQuery, `Searching for device ${this._commentQuery(deviceQuery)} ...`);

    if (_.isEmpty(result)) {
      throw new DetoxRuntimeError({
        message: `Failed to find a device ${this._commentQuery(deviceQuery)}`,
        hint:
          `Run 'applesimutils --list' to list your supported devices. ` +
          `It is advised only to specify a device type, e.g., "iPhone Xʀ" and avoid explicit search by OS version.`
      });
    }

    return result;
  }

  _adaptQuery(rawDeviceQuery) {
    let byId, byName, byOS, byType;

    if (_.isPlainObject(rawDeviceQuery)) {
      byId = rawDeviceQuery.id;
      byName = rawDeviceQuery.name;
      byOS = rawDeviceQuery.os;
      byType = rawDeviceQuery.type;
    } else {
      if (_.includes(rawDeviceQuery, ',')) {
        [byType, byOS] = _.split(rawDeviceQuery, /\s*,\s*/);
      } else {
        byType = rawDeviceQuery;
      }
    }

    return _.omitBy(
      {
        byId,
        byName,
        byOS,
        byType
      },
      _.isUndefined
    );
  }

  _commentQuery({ byId, byName, byOS, byType }) {
    return _.compact([
      byId && `by UDID = ${JSON.stringify(byId)}`,
      byName && `by name = ${JSON.stringify(byName)}`,
      byType && `by type = ${JSON.stringify(byType)}`,
      byOS && `by OS = ${JSON.stringify(byOS)}`
    ]).join(' and ');
  }

  _commentDevice(rawDeviceQuery) {
    return _.isPlainObject(rawDeviceQuery) ? JSON.stringify(rawDeviceQuery) : `(${rawDeviceQuery})`;
  }

  async setStatusBar(deviceId, flags) {
    // await this.applesimutils.statusBarOverride(deviceId, flags);
  }

  async resetStatusBar(deviceId) {
    // await this.applesimutils.statusBarReset(deviceId);
  }

  async waitUntilReady() {
    await this.testee.connect();
  }
}

module.exports = PuppeteerDriver;

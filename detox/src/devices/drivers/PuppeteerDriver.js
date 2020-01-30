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

function sleep(ms) {
  return new Promise((res) => {
    setTimeout(res, ms);
  });
}

function debug(label, ...args) {
  return;
  console.log(`PuppeteerDriver.${label}`, ...args);
}

let browser, page;
let urlBlacklist = [];
class PuppeteerTestee {
  constructor(config) {
    console.log('PuppeteerTestee.constructor', config);
    this.configuration = config.client.configuration;
    this.client = new Client(this.configuration);
  }

  async selectElementWithMatcher(...args) {
    console.log('selectElementWithMatcher', JSON.stringify(args, null, 2));
    const selectorArg = args.find((a) => a.method === 'selector');
    const timeoutArg = args.find((a) => a.method === 'option' && typeof a.args[0].timeout === 'number');
    const indexArg = args.find((a) => a.method === 'index');
    try {
      const a = await page.waitFor(
        ({ selectorArg, indexArg }) => {
          const xpath = selectorArg.args[0];
          const isContainMatcher = xpath.includes('contains(');
          // return document.querySelector(selectorArg ? selectorArg.args.join('') : 'body');
          // let candidates = Array.prototype.slice.apply(document.querySelectorAll(selectorArg ? selectorArg.args.join('') : 'body'), [0]);
          const iterator = document.evaluate(`//*${xpath}`, document.body);
          const elements = [];
          let maybeElement, lastMatch;
          while ((maybeElement = iterator.iterateNext())) {
            lastMatch = maybeElement;
            // xpaths matching on text match every parent in addition to the
            // element we actually care about so only take the element if it
            // is a leaf
            if (!isContainMatcher || maybeElement.children.length === 0) {
              elements.push(maybeElement);
            }
          }

          return elements[indexArg ? indexArg.args[0] : 0];
        },
        { timeout: timeoutArg ? timeoutArg.args[0].timeout : 100 },
        { selectorArg, indexArg }
      );
      console.log(a);
      return a;
    } catch (e) {
      console.warn(e);
      return null;
    }
  }

  async getElementHandle(...args) {
    console.log('getElementHandle', args);
    return await page.waitForSelector(...args);
  }

  async performAction(element, action) {
    console.log('performAction', action);
    if (action.method === 'replaceText') {
      await element.click();
      await page.keyboard.type(action.args[0]);
      return true;
    } else if (action.method === 'typeText') {
      await element.click();
      await page.keyboard.type(action.args[0]);
      return true;
    } else if (action.method === 'keyboardPress') {
      await element.click();
      await page.keyboard.press(action.args[0]);
      return true;
    } else if (action.method === 'clearText') {
      const elementValue = await element.evaluate((el) => el.value);
      await element.click();
      for (let i = 0; i < elementValue.length; i++) {
        await page.keyboard.press('Backspace');
      }
      return true;
    } else if (action.method === 'tap') {
      await element.tap();
      return true;
    } else if (action.method === 'tapAtPoint') {
      const box = await element.boundingBox();
      const x = box.x + action.args[0].x;
      const y = box.y + action.args[0].y;
      await page.touchscreen.tap(x, y);
      return true;
    } else if (action.method === 'longPress') {
      await element.evaluate(
        (el, { duration }) => {
          return new Promise((resolve) => {
            const boundingBox = el.getBoundingClientRect();
            const pageX = boundingBox.x + boundingBox.width / 2;
            const pageY = boundingBox.y + boundingBox.height / 2;
            const touch = new Touch({
              identifier: Date.now(),
              target: document,
              pageX: 600,
              pageY: 85
            });
            const start = new TouchEvent('touchstart', {
              cancelable: true,
              bubbles: true,
              touches: [touch],
              targetTouches: [],
              changedTouches: [touch]
            });
            const end = new TouchEvent('touchend', {
              cancelable: true,
              bubbles: true,
              touches: [touch],
              targetTouches: [],
              changedTouches: [touch]
            });

            el.dispatchEvent(start);

            setTimeout(() => {
              el.dispatchEvent(end);
              resolve();
            }, duration);
          });
        },
        { duration: action.args[0] }
      );
      return true;
    } else if (action.method === 'multiTap') {
      for (let i = 0; i < action.args[0]; i++) {
        await element.tap();
      }
      return true;
    } else if (action.method === 'scroll') {
      const direction = action.args[0];
      const pixels = action.args[1];

      // TODO handle all options
      let top = 0;
      let left = 0;
      if (direction === 'down') {
        top = pixels;
      } else if (direction === 'up') {
        top = -pixels;
      } else if (direction === 'right') {
        left = pixels;
      } else if (direction === 'left') {
        left = -pixels;
      }

      await element.evaluate(
        (el, scrollOptions) => {
          console.log(el, scrollOptions);
          el.scrollBy(scrollOptions);
        },
        { top, left }
      );
      return true;
    } else if (action.method === 'scrollTo') {
      const edge = action.args[0];

      let top = 0;
      let left = 0;
      if (edge === 'bottom') {
        top = 10000;
      } else if (edge === 'top') {
        top = -10000;
      } else if (edge === 'left') {
        left = -10000;
      } else if (edge === 'right') {
        left = 10000;
      }

      await element.evaluate(
        (el, scrollOptions) => {
          el.scrollBy(scrollOptions);
        },
        { top, left }
      );
      return true;
    } else if (action.method === 'swipe') {
      const direction = action.args[0];
      const speed = action.args[1];
      const percentage = action.args[2];

      // TODO handle all options
      let top = 0;
      let left = 0;
      if (direction === 'up') {
        top = 10000;
      } else if (direction === 'down') {
        top = -10000;
      } else if (direction === 'left') {
        left = 10000;
      } else if (direction === 'right') {
        left = -10000;
      }

      await element.evaluate(
        (el, scrollOptions) => {
          el.scrollBy(scrollOptions);
        },
        { top, left }
      );
      return true;
    }

    // await element.evaluate((el, action) => {
    //   console.log(el, action);
    // });

    throw new Error('action not performed: ' + JSON.stringify(action));
  }

  async assertWithMatcher(element, matcher) {
    console.log('assertWithMatcher', matcher);
    const isExists = !!element;
    const isVisibleMatcher = matcher.method === 'option' && matcher.args[0].visible === true;
    const isNotVisibleMatcher = matcher.method === 'option' && matcher.args[0].visible === false;
    const isExistsMatcher = matcher.method === 'option' && matcher.args[0].exists === true;
    const isNotExistsMatcher = matcher.method === 'option' && matcher.args[0].exists === false;
    console.log('assertWithMatcher', { isExists, isVisibleMatcher, isNotVisibleMatcher, isExistsMatcher, isNotExistsMatcher });

    let result = true;
    if (isVisibleMatcher || isNotVisibleMatcher) {
      const isVisible = isExists ? await element.isIntersectingViewport() : false;
      if (isVisibleMatcher && !isVisible) {
        result = false;
      }
      if (isNotVisibleMatcher && isVisible) {
        result = false;
      }
    }
    if (isExistsMatcher || isNotExistsMatcher) {
      if (isExistsMatcher && !isExists) {
        result = false;
      }
      if (isNotExistsMatcher && isExists) {
        result = false;
      }
    }

    if (matcher.method === 'selector') {
      result = await element.evaluate((el, selector) => {
        const iterator = document.evaluate(`//*${selector}`, el);
        return !!iterator.iterateNext();
      }, matcher.args[0]);
    }

    if (!result) throw new Error('assertion failed');
    return result;
  }

  async invoke(params, logLevel = console.log) {
    logLevel('invoke', JSON.stringify(params, null, 2));
    const promises = params.args.map((arg) => {
      logLevel('arg', arg);
      if (arg.type === 'Invocation') {
        console.log('going to invoke, be careful');
        return this.invoke(arg.value);
      }
      return arg;
    });

    const args = await Promise.all(promises);
    logLevel('call', params, args);
    if (params.target === 'this' || params.target.type === 'this') {
      const result = await this[params.method](...args);
      logLevel('result?', params.method, !!result);
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
      let actionComplete = false;
      const inflightRequests = {};

      const networkSettledPromise = new Promise((resolve) => {
        function addInflightRequest(request) {
          inflightRequests[request.uid] = true;
        }

        function removeInflightRequest(request) {
          delete inflightRequests[request.uid];
          if (actionComplete && Object.keys(inflightRequests).length === 0) resolve();
        }

        page.on('request', (request) => {
          request.uid = Math.random();
          const url = request.url();
          const isIgnored = urlBlacklist.some((candidate) => {
            return url.match(new RegExp(candidate));
          });
          if (!isIgnored) {
            addInflightRequest(request);
          }
        });
        page.on('requestfinished', (request) => {
          removeInflightRequest(request);
        });
        page.on('requestfailed', (request) => {
          removeInflightRequest(request);
        });
      });

      const sendResponse = (response) => {
        console.log('sendResponse');
        actionComplete = true;
        const sendResponsePromise = Object.keys(inflightRequests).length === 0 ? Promise.resolve() : networkSettledPromise;
        return sendResponsePromise.then(() => {
          this.client.ws.ws.send(JSON.stringify(response));
        });
      };

      let messageId;
      try {
        const action = JSON.parse(str);
        messageId = action.messageId;
        console.log('PuppeteerTestee.message', JSON.stringify(action, null, 2));
        if (!action.type) {
          return;
        }
        if (action.type === 'loginSuccess') {
          return;
        } else if (action.type === 'deliverPayload') {
          await sendResponse({ type: 'deliverPayloadDone', messageId: action.messageId });
        } else if (action.type === 'currentStatus') {
          await sendResponse({ type: 'currentStatusResult', params: { resources: [] } });
        } else {
          try {
            await this.invoke(action.params);
            await sendResponse({ type: 'invokeResult', messageId: action.messageId });
          } catch (error) {
            await sendResponse({ type: 'testFailed', messageId, params: { details: error.message } });
          }
        }
      } catch (error) {
        await sendResponse({ type: 'error', messageId: messageId, params: { error } });
        console.error(error);
        browser.close();
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
    debug('TODO setURLBlacklist should go through client', urlList);
    urlBlacklist = urlList;
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
    browser = await puppeteer.launch({ devtools: true, headless: false });
    console.log('override', launchArgs.detoxURLOverride);
    const url = launchArgs.detoxURLOverride || this.deviceConfig.baseUrl;
    if (url) {
      page = (await browser.pages())[0];
      await page.goto(url);
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
    this.deviceConfig = deviceConfig;
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

  async reloadReactNative() {
    const url = this.deviceConfig.baseUrl;
    if (url) {
      page = (await browser.pages())[0];
      await page.goto(url);
    }
  }
}

module.exports = PuppeteerDriver;

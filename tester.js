const puppeteer = require('puppeteer');

let browser;

function sleep(ms) {
  return new Promise((res) => {
    setTimeout(res, ms);
  });
}

async function main() {
  browser = await puppeteer.launch({ headless: false });
  const page = (await browser.pages())[0];
  await page.goto('file:///Users/awinograd/programming/oui-aviva/web-build/index.html');
  const outer = 'scope';
  const el = await page.waitForXPath('//*[@class="css-901oao"][contains(., "Actions")]', { timeout: 1000 });
  await el.tap();
  const longEl = await page.waitForXPath('//*[@class="css-901oao"][contains(., "Long Press Me")]', { timeout: 1000 });
  console.log(await longEl.boundingBox());
  await longEl.evaluate(
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
        }, duration);
      });
    },
    { duration: 2500 }
  );

  // await page.waitForSelector('[data-testid="sLogin_email"]', { timeout: 1000 });
  // const a = await page.waitFor(
  //   (outer) => {
  //     let candidates = Array.prototype.slice.apply(document.querySelectorAll('div'), [0]);
  //     const indexArg = { args: [0] };
  //     let containsTextArg;

  //     console.log(candidates);

  //     if (containsTextArg) {
  //       candidates = candidates
  //         .map((candidate) => {
  //           const xPathResult = document.evaluate(`//*[contains(., '${containsTextArg.args[0]}')]`, candidate);
  //           let element;
  //           while ((element = xPathResult.iterateNext())) {}
  //           return element;
  //         })
  //         .filter((e) => !!e);
  //     }

  //     return candidates[indexArg ? indexArg.args[0] : 0];

  //     console.log('test', outer);
  //     return document.querySelector('[data-testid="Login_email"]');
  //   },
  //   { timeout: 10000 },
  //   outer
  // );
  // a.evaluate((el, foo, bar) => console.log(el, foo, bar), 1, 2);
  await sleep(10000);
}

main()
  .then(console.log)
  .catch(console.error)
  .then(async () => {
    await browser.close();
  });

import puppeteer from "puppeteer";

async function scrape() {

  //    const url = "https://jac-its.it/";
  const url = "https://jobsacademy.org/contatti/"

  const browser = await puppeteer.launch({ headless: false, executablePath: '/usr/bin/google-chrome' });

  const page = await browser.newPage();

  await page.setViewport({ width: 1920, height: 1080 })

  const recorder = await page.screencast({ path: 'video.webm' })

  await page.goto(url, {
    waitUntil: 'networkidle2', timeout: 30000
  });

  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.')


  await page.waitForSelector('input[name="your-name"]', { timeout: 10000 })

  await page.$eval('.iubenda-cs-reject-btn', (el) => el.click())

  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight)
  })

  await page.type('input[name="your-name"]', 'prova')
  await page.type('input[name="your-surname"]', 'test')

  await page.type('input[name="your-email"]', 'test@test.it')
  await page.type('input[name="your-phone"]', '1234566789')
  await page.type('input[name="your-oggetto"]', 'test')
  await page.type('textarea[name="your-message"]', 'messaggio di test messaggio di test messaggio di test messaggio di test')

  await page.$eval('input[name="your-privacy"]', (el) => el.click())
  await page.$eval('button[type="submit"]', (el) => el.click())

  await page.screenshot({ path: './screenshot.png', fullPage: true });

  await page.waitForNetworkIdle({ timeout: 30000 })

  await recorder.stop()
  await page.close()
  await browser.close()


}

scrape()
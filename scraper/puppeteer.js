import puppeteer from "puppeteer";

async function scrape() {
  //    const url = "https://jac-its.it/";
  const url = "https://jobsacademy.org/contatti/";

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: "/usr/bin/google-chrome",
  });

  const page = await browser.newPage();

  await page.setViewport({ width: 1920, height: 1080 });

  const recorder = await page.screencast({ path: "recording.webm" });

  // Do something.

  // Stop recording.

  await page.goto(url, {
    waitUntil: "networkidle2",
    timeout: 30000,
  });

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.",
  );

  // scrool to bottom
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
  });

  await page.waitForSelector(".iubenda-cs-accept-btn", {
    timeout: 30000,
    visible: true,
  });
  await page.$eval(".iubenda-cs-accept-btn", (el) => el.click());

  await new Promise((resolve) => setTimeout(resolve, 1000));

  await page.type('input[name="your-name"]', "test");
  await page.type('input[name="your-surname"]', "test-cognome");
  await page.type('input[name="your-email"]', "test@test.it");
  await page.type('textarea[name="your-message"]', "test");
  await page.type('input[name="your-phone"]', "1234567890");
  await page.type('input[name="your-oggetto"]', "test");

  // spunta la checkbox della privacy
  await page.click('input[name="your-privacy"]', { delay: 50 });
  await page.$eval('input[name="your-privacy"]', (el) => el.click());

  await new Promise((resolve) => setTimeout(resolve, 3000));

  // clicca il submit e "ascolta" un cambio di URL (redirect)
  const urlBeforeSubmit = page.url();

  await page.click('button[type="submit"]', { delay: 50 });
  await page.$eval('button[type="submit"]', (el) => el.click());

  try {
    await page.waitForFunction(
      (oldUrl) => window.location.href !== oldUrl,
      { timeout: 30000 },
      urlBeforeSubmit,
    );
  } catch (e) {
    console.log(
      "nessun redirect entro 30s (potrebbe essere un submit via AJAX sulla stessa pagina)",
    );
  }

  await page.screenshot({ path: "./screenshot.png", fullPage: true });

  const url2 = page.url();

  console.log("dopo submit / possibile redirect sono a:", url2);

  // await page.waitForSelector('.list-courses-simple', { timeout: 30000 })

  // const data = await page.evaluate(() => {
  //     const courses = Array.from(document.querySelectorAll('.list-courses-simple .content a'))
  //         .map(course => course.innerText)
  //     return courses
  // })

  // console.log(data)
  await recorder.stop();

  await page.close();
  await browser.close();
}

scrape();

import puppeteer from "puppeteer";

async function scrape() {

    //    const url = "https://jac-its.it/";
    const url = "https://jac-its.it/sostieni-la-fondazione/"

    const browser = await puppeteer.launch({ headless: true, executablePath: '/usr/bin/google-chrome' });

    const page = await browser.newPage();

    await page.goto(url, {
        waitUntil: 'networkidle2', timeout: 30000
    });

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.')

    await page.setViewport({ width: 1280, height: 720 })

    await page.waitForSelector('input[name="formName"]', { timeout: 30000 })

    await page.type('input[name="formName"]', 'test')
    await page.type('input[name="formSurname"]', 'test')

    await page.type('input[name="formEmail"]', 'test@test.it')
    await page.type('input[name="formPhone"]', '1234566789')

    await page.click('input[name="formPrivacy"]')

    await page.click('input[value="Invia richiesta"]')

    await page.screenshot({ path: './screenshot.png', fullPage: true });

    await page.waitForNetworkIdle({ timeout: 30000 })

    const url2 = page.url()

    console.log('done, sono a ', url2)

    // await page.waitForSelector('.list-courses-simple', { timeout: 30000 })

    // const data = await page.evaluate(() => {
    //     const courses = Array.from(document.querySelectorAll('.list-courses-simple .content a'))
    //         .map(course => course.innerText)
    //     return courses
    // })

    // console.log(data)

}

scrape()
import { OpenAI } from "openai/client.js";
import { zodResponseFormat } from 'openai/helpers/zod';
import puppeteer from "puppeteer";
import { z } from 'zod/v3';


const OPEN_AI_KEY = "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"
const browser = await puppeteer.launch({ headless: true, executablePath: '/usr/bin/google-chrome' })

async function saveImg(text) {

    console.log(text)

    const page = await browser.newPage()
    await page.setViewport({ width: 800, height: 800 })

    await page.setContent(`
        <!DOCTYPE html>
<html lang="it">

<head>
    <meta charset="UTF-8">
    <title>Ultime Notizie</title>
    <style>
        body {
            margin: 0;
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: Arial, Helvetica, sans-serif;
            background: linear-gradient(135deg, #2f6df6, #ff4f9a);
        }

        .card {
            width: 700px;
            padding: 60px 40px;
            background: #2c2954;
            border-radius: 30px;
            text-align: center;
            color: white;
        }

        .small-title {
            font-size: 36px;
            letter-spacing: 2px;
            margin-bottom: 60px;
            opacity: 0.9;
        }

        .headline {
            font-size: 64px;
            font-weight: 800;
            line-height: 1.15;
            margin-bottom: 60px;
        }

        .hashtag {
            font-size: 36px;
            color: #b7c0ff;
            font-weight: 700;
        }

        @media (max-width:768px) {
            .card {
                width: 90%;
                padding: 40px 20px;
            }

            .headline {
                font-size: 40px;
            }

            .small-title {
                font-size: 24px;
            }

            .hashtag {
                font-size: 24px;
            }
        }
    </style>
</head>

<body>

    <div class="card">
        <div class="small-title">ULTIME NOTIZIE</div>

        <div class="headline">
          ${text}
        </div>

        <div class="hashtag">#TRENDBOT</div>
    </div>

</body>

</html>
        `)

    await page.screenshot({ path: 'result.png' })

    await page.close()
    await browser.close()
}

async function getData() {
    const page = await browser.newPage()
    await page.setViewport({ width: 1920, height: 1080 })
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.')

    await page.goto('https://www.ansa.it', { waitUntil: 'networkidle2' })

    const titles = await page.evaluate(() => {

        const titlesHMTL = Array.from(document.querySelectorAll('.title'))

        return titlesHMTL.map((el) => el.textContent.trim())
    })

    console.log(titles)

    const title = titles[Math.floor(Math.random() * titles.length)]
    console.log(title)

    const newTitle = await makeTitleWithAI(title)

    await saveImg(newTitle)
}

async function makeTitleWithAI(oldTitle) {
    const client = new OpenAI({ apiKey: OPEN_AI_KEY })

    const titleSchema = z.object({
        text: z.string().describe('il testo del titolo rielaborato').max(50).min(40)
    })

    const response = await client.chat.completions.parse({
        model: 'gpt-4o-mini',
        messages: [
            {
                role: 'system',
                content: `Sei un sistema per la rilaborazione di titoli giornalistici. 
                Rielabora il testo che ti viene dato`
            },
            {
                role: 'user',
                content: oldTitle
            }
        ],
        response_format: zodResponseFormat(titleSchema, 'titolo')
    })
    console.log(response)
    console.log(response.choices)
    console.log(response.choices[0])
    console.log(response.output_text)
    return JSON.parse(response.choices[0].message.content).text

}

await getData()
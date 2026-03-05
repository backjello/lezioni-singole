import Database from "better-sqlite3";
import TelegramBot from "node-telegram-bot-api";
import puppeteer from "puppeteer";


const TELEGRAM_BOT_TOKEN = "8697561868:AAG1YI6ASvz5Tj7VoEV17MLMJu3LdR30dSQ"
const AMAZON_URL = "https://www.amazon.it/dp/B01D625WN8"

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true })
const db = new Database('product.db')

bot.onText('ciao', (msg) => {
    const chatId = msg.chat.id
    bot.sendMessage(chatId, 'ciao a te!')
})

bot.onText('/check', async (msg) => {
    const chatId = msg.chat.id
    await checkPrice(chatId)
})

async function checkPrice(chatId) {
    const browser = await puppeteer.launch({ headless: false, executablePath: '/usr/bin/google-chrome' })
    const page = await browser.newPage()
    await page.setViewport({ width: 1920, height: 1080 })
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.')
    await page.goto(AMAZON_URL)

    await page.waitForSelector('.a-price .a-offscreen', { timeout: 10000 })

    const price = await page.evaluate(() => {
        let price = document.querySelector('.a-price .a-offscreen').textContent
        price = price.slice(1)
        price = price.replace(',', '.')
        price = parseFloat(price)
        console.log(price)
        return price
    })
    console.log(price)

    const oldPriceQuery = db.prepare(`
        SELECT price FROM prodotto WHERE url=?
        `)

    const oldRecord = oldPriceQuery.get(AMAZON_URL)

    console.log(oldRecord);

    if (!oldRecord.price) {
        const priceInsert = db.prepare(`INSERT INTO prodotto (url,price) VALUES (?,?)`)
        priceInsert.run(AMAZON_URL, price)
    }
    else {
        const oldPrice = oldRecord.price

        if (oldPrice > price) {
            bot.sendMessage(chatId, `
                Il prodotto è adesso in offerta
                Prezzo vecchio: ${oldPrice}€
                Nuovo Prezzo: ${price}€
                `
            )
        }
    }

}

async function createDB() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS prodotto (
         url varchar(100) PRIMARY KEY,
         price float(8,4) NOT NULL
        )
        `)
}

await createDB()
import OpenAi from 'openai'
import { zodResponseFormat } from 'openai/helpers/zod'
import { z } from 'zod/v3'

const key = ""

// creo il client per la comunicazione con il BE di openAI
const client = new OpenAi({
    apiKey: key
})

const prodottoSchema = z.object({
    tipoProdotto: z.string().describe('il tipo di prodotto che sta cercando l\'utente, potrebbe essere maglietta, pantaloni ecc'),
    colore: z.string().nullable().describe('il colore del prodotto ricercato'),
    taglia: z.enum(['XS', 'S', 'M', 'L', 'XL']),
    materiale: z.string().nullable().describe('il materiale del prodotto ricercato'),
    marche: z.array(z.string()).describe('l\'elenco delle marche ricercate')
})

const response = await client.chat.completions.parse({
    model: 'gpt-4o-mini',
    messages: [
        {
            role: 'system',
            content: `Sei un assistente in un e-commerce di abbigliamento.
            Creami dei filtri per il seguente messaggio`
        },
        {
            role: 'user',
            content: `Creami dei filtri per il seguente messaggio: 
                "Voglio una maglietta bianca, taglia grande, marca adidas o nike, in cotone"`,
        }
    ],
    response_format: zodResponseFormat(prodottoSchema, 'prodotto')
})
console.log(response)
console.log(response.choices)
console.log(response.choices[0])
console.log(response.output_text)
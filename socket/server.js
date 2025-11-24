// per creare il server sul quale si deve appoggiare il socket-server
const http = require('http')
// per creare il serer socket
const { Server } = require("socket.io")

const httpServer = http.createServer()

const io = new Server(httpServer, {
    cors: {
        origin: ['http://localhost:5500', 'http://127.0.0.1:5500'],
        methods: ['GET', 'POST']
    }
})

try {
    io.listen(3334) // avvio il server sulla porta 3334
    console.log('Server socket avviato con successo')
} catch (error) {
    console.error('Impossibile avviare il server', error)
}

io.on('connection', (socket) => {
    console.log('nuova connessione', socket.id)

    // inserisco il client appena connesso in una stanza
    socket.join('tabellone')

    // socket.on('evento-di-test', (data) => console.log('ho ricevuto un evento di test', data))

    // setInterval(() => {
    //     socket.emit('evento-di-prova')
    // }, 2500)

    socket.on('chiama', (numero) => {
        console.log('è stato chiamato il numero ', numero)
        // socket rappresenta la singola connessione
        // socket.emit('mostra-numero', numero)
        // mando l'evento a tutte le socket presenti sul server (compreso il 'chiamante')
        // io.emit('mostra-numero', numero)
        // mando l'evento a tutti, tranne il chiamante
        // socket.broadcast.emit('mostra-numero', numero)
        // mando un messaggio solamente a chi è dentro la stanza 'tabellone'
        socket.to('tabellone').emit('mostra-numero', numero)

    })

    socket.on('disconnect', (socket) => {
        console.log('socket disconnessa', socket.id)
    })
})

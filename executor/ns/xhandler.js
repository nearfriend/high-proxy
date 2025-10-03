const dns2 = require('dns2');

const { Packet } = dns2;

const server = dns2.createServer({
    udp: true,
    tcp: true,
    handle: (request, send, rinfo) => {
        console.log(JSON.stringify(request))
        const response = Packet.createResponseFromRequest(request);
        const [question] = request.questions;
        const { name } = question;
        response.answers.push({
            name,
            type: Packet.TYPE.A,
            class: Packet.CLASS.IN,
            ttl: 300,
            address: '8.8.8.8',
        });
        send(response);
    },
});

server.on('request', (request, response, rinfo) => {
    console.log(JSON.stringify(rinfo))
    console.log(request.header.id, request.questions[0]);
});

server.on('requestError', (error) => {
    console.log('Client sent an invalid request', error);
});

server.on('listening', () => {
    console.log(server.addresses());
});

server.on('close', () => {
    console.log('server closed');
});


server.listen({
    // Optionally specify port, address and/or the family of socket() for udp server:
    udp: {
        port: 53,
        // address: '212.118.39.181',
        type: 'udp6', // IPv4 or IPv6 (Must be either "udp4" or "udp6")
    },

    // Optionally specify port and/or address for tcp server:
    tcp: {
        port: 53,
        // type: 'ipv4',
        address: '0.0.0.0',
    },
});

// eventually
// server.close();


// const server = dns.createUDPServer((request, send, rinfo) => {
//     const response = Packet.createResponseFromRequest(request);
//     const [ question ] = request.questions;
//     const { name } = question;
//     response.answers.push({
//       name,
//       type    : Packet.TYPE.A,
//       class   : Packet.CLASS.IN,
//       ttl     : 300,
//       address : '8.8.8.8',
//     });
//     send(response);
//   });
  
//   server.on('request', (request, response, rinfo) => {
//     console.log(request.header.id, request.questions[0]);
//   });
  
//   server.listen(53);
const {
    WAConnection,
    MessageType,
    Presence,
    MessageOptions,
    Mimetype,
    WALocationMessage,
    WA_MESSAGE_STUB_TYPES,
    messageStubType,
    ReconnectMode,
    ProxyAgent,
    waChatKey,
    WAMessageProto,
	prepareMessageFromContent,
    relayWAMessage,
} = require("@adiwajshing/baileys");
const fs = require('fs');
const moment = require('moment-timezone');
const afkJs = require('./lib/afk')
const yargs = require('yargs/yargs')
const vn = JSON.parse(fs.readFileSync('./lib/json/vn.json'))
const ClientJs = require('./lib/client');
const cron = require('node-cron');
global.configs = JSON.parse(fs.readFileSync('./config.json'));
let dataUser = JSON.parse(fs.readFileSync('./lib/json/dataUser.json'))
global.vn = JSON.parse(fs.readFileSync('./lib/json/vn.json'))
global.tebakgambar = {}
moment.tz.setDefault('Asia/Jakarta').locale('id');
const { color } = require('./lib/func')
const Crypto = require('crypto')

const starts = async (sesName) => {
    try {
        const Client = new ClientJs(global.configs, sesName || global.configs.defaultSessionName)
		const client = Client.mainClient
		require("./lib/http-server")(client)
        Client.starts()
		detectChange('./handler.js', (mdl) =>{
			try{
			Client.cmd.removeAllListeners()
			Client.handlerStick.removeAllListeners()
			require('./handler')(client, Client)
			console.log(color('[ INFO ]', 'cyan'), `${mdl} auto updated!`)
			} catch (err) {
             console.error(err)
           }
		})
		require('./handler')(client, Client)
		
        client.on('CB:Presence', asd => {
        	asd = asd[1]
            if (!asd.id.endsWith('@g.us')) return
            if((asd.type == 'composing' || asd.type == 'recording') && afkJs.detectingAfk(asd.id, asd.participant)) {
            Client.sendText(asd.id, `@${asd.participant.split('@')[0]} terdeteksi melakukan aktivitas!, status afkMu telah dihapus`)
                }
        })
		client.on('CB:Call', json => {
			client.query({json: ["action","call",["call",{"from":client.user.jid,"to":json[1].from,"id":generateMessageID()},[["reject",{"call-id":json[1].id,"call-creator":json[1].from,"count":"0"},null]]]]}).then(() =>{
			setTimeout(async () =>{
			if (Client.blocklist.includes(json[1].from)) return
			client.blockUser(json[1].from, 'add')   
			}, 3000)
		}).catch()  
		})
        client.on('new-msg', (message) => {
            if(message.key && message.key.remoteJid == 'status@broadcast') return
            if(message.key.fromMe && !Client.self || !message.key.fromMe && Client.self) return
			let dataGc = JSON.parse(fs.readFileSync('./lib/json/dataGc.json'))
			const body = message.body
			const from = message.key.remoteJid
            const isGroup = from.endsWith('@g.us')
            const sender = isGroup ? message.participant : from
			if (global.tebakgambar[from] && global.tebakgambar[from].id && global.tebakgambar[from].jawaban.toLowerCase() == body.toLowerCase()) Client.reply(from, `YES TEBAK GAMBAR BERHASIL DIJAWAB OLEH @${sender.split("@")[0]}`, message).then(() => global.tebakgambar[from] = {}) 
			if (global.vn.includes(body)) Client.sendPtt(from, `./lib/vn/${body}.mp3`, message)
			if (isGroup && !dataGc[from]){
				dataGc[from] = {afk:{}}
				fs.writeFileSync('./lib/json/dataGc.json', JSON.stringify(dataGc, null, 2))
			}
            if (isGroup && dataGc[from].antitagall && !message.isAdmin && (message.mentionedJidList.length == message.groupMembers.length || message.mentionedJidList.length-1 == message.groupMembers.length)){
                Client.reply(from, 'Tagall detected', message)
                client.groupRemove(from, [sender]).catch(() => Client.reply(from, `Jadikan bot admin agar bisa menggunakan fitur antitagall`, message))
            }
            if (isGroup && dataGc[from].antiviewonce && message.type == 'viewOnceMessage'){
                var msg = {...message}
                msg.message = message.message.viewOnceMessage.message
                msg.message[Object.keys(msg.message)[0]].viewOnce = false
                Client.reply(from, 'ViewOnce detected!', message)
                client.forwardMessage(from, msg)
            }
			if (isGroup && !message.isAdmin && dataGc[from].antilink && /chat\.whatsapp\.com/gi.test(body)){
				let dtclink = body.match(/chat.whatsapp.com\/(?:invite\/)?([0-9A-Za-z]{18,26})/gi) || []
				dtclink.forEach(async l => {
					checks = await Client.checkInviteLink(l)
					if(checks.status == 200){
						Client.reply(from, `Group link detected!`, message)
						client.groupRemove(from, [sender]).catch(() => Client.reply(from, `Jadikan bot admin agar bisa menggunakan fitur antilink`, message))
					}
				})
			}
			if (!dataUser[sender]){
				dataUser[sender] = {limit: 0, premium: false}
				fs.writeFileSync('./lib/json/dataUser.json', JSON.stringify(dataUser))
			}
            if(isGroup) {
                if(afkJs.detectingAfk(from, sender)) Client.sendText(from, `@${sender.split('@')[0]} sekarang tidak afk!`)
                if(message.message.extendedTextMessage && message.message.extendedTextMessage.contextInfo && message.message.extendedTextMessage.contextInfo.mentionedJid) {
                    jids = message.message.extendedTextMessage.contextInfo.mentionedJid
                    jids.forEach(jid => {
                        takeData = afkJs.tagDetect(from, jid)
                        if(!takeData) return
                        duration = moment.duration(moment(takeData.time).diff(moment()))
                        Client.reply(from, `@${jid.split('@')[0]} sedang afk\nReason: ${takeData.reason}\nTime: ${duration.days()} Hari ${duration.hours()} Jam ${duration.minutes()} Menit ${duration.seconds()} detik`)
                    })
                }
            }
        })
		client.on('group-participants-update', (jdgn) => require('./lib/greet.js')(jdgn, Client, client))
    } catch (e) {
        console.error(e)
    }
}

cron.schedule('0 0 * * *', () => {
    for (users in dataUser){
		dataUser[users].limit = 0
	}
    fs.writeFileSync('./lib/json/dataUser.json', JSON.stringify(dataUser))
    console.log(color('[ INFO ]', 'cyan'), 'LIMIT RESETED!')
});
detectChange('./lib/text.js', (mdl) => console.log(color('[ INFO ]', 'cyan'), `${mdl} change is detected!`))
detectChange('./lib/greet.js', (mdl) => console.log(color('[ INFO ]', 'cyan'), `${mdl} change is detected!`))
function detectChange(module, cb){
	fs.watchFile(require.resolve(module), () => {
	 delete require.cache[require.resolve(module)]
	 if (cb) cb(module)
    })
}
const randomBytes = (length) => {
    return Crypto.randomBytes(length)
}
global.generateMessageID = () => {
    return '3EB0' + randomBytes(7).toString('hex').toUpperCase()
}
global.optn = yargs(process.argv.slice(2)).exitProcess(false).parse()
starts(process.argv[2])


/*

Made by Jesen N#9071

Sengaja bikin pake bahasa indo, kalau mau ganti, ganti aja

*/

const { WAConnection, MessageType } = require("@adiwajshing/baileys");

const fs = require("fs");

const ms = require("parse-ms");

const db = require("quick.db");

const join = JSON.parse(fs.readFileSync("./data/join.json"));

const config = require("./data/config.json");

prefix = config.prefix;

async function start() {

  const client = new WAConnection();

  client.version = [2, 2144, 10];

  client.on("qr", () => {

    console.log("Sqan Qr Code");

  });

  fs.existsSync("./jesenN.json") && client.loadAuthInfo("./jesenN.json");

  client.on("connecting", () => {

    console.log("Connecting...");

  });

  client.on("open", () => {

    fs.writeFileSync(

      "./jesenN.json",

      JSON.stringify(client.base64EncodedAuthInfo(), null, "\t")

    );

    console.log("Connected!");

  });

  await client.connect();

  client.on("chat-update", async (sen) => {

    try {

      if (!sen.hasNewMessage) return;

      sen = sen.messages.all()[0];

      global.prefix;

      if (!sen.message) return;

      if (sen.key && sen.key.remoteJid == "status@broadcast") return;

      if (sen.key.fromMe) return;

      const type = Object.keys(sen.message)[0];

      const from = sen.key.remoteJid;

      const { text, extendedText } = MessageType;

      body =

        type === "conversation" && sen.message.conversation.startsWith(prefix)

          ? sen.message.conversation

          : type == "imageMessage" &&

            sen.message.imageMessage.caption.startsWith(prefix)

          ? sen.message.imageMessage.caption

          : type == "videoMessage" &&

            sen.message.videoMessage.caption.startsWith(prefix)

          ? sen.message.videoMessage.caption

          : type == "extendedTextMessage" &&

            sen.message.extendedTextMessage.text.startsWith(prefix)

          ? sen.message.extendedTextMessage.text

          : "";

      const isGroup = from.endsWith("@g.us");

      const sender = isGroup ? sen.participant : sen.key.remoteJid;

      const isOwner = config.ownerNumber.includes(sender);

      const isJoin = join.includes(sender);

      const conts = sen.key.fromMe

        ? client.user.jid

        : client.contacts[sender] || {

            notify: client.user.jid.replace(/@.+/, ""),

          };

      const groupMetadata = isGroup ? await client.groupMetadata(from) : "";

      const groupMembers = isGroup ? groupMetadata.participants : "";

      const groupName = isGroup ? groupMetadata.subject : "";

      const username = sen.key.fromMe

        ? client.user.name

        : conts.notify || conts.vname || conts.name || "-";

      const isCmd = body.startsWith(prefix);

      const command = body.slice(1).trim().split(/ +/).shift().toLowerCase();

      const args = body.trim().split(/ +/).slice(1);

      //group chatlog

      if (isCmd && isGroup) {

        console.log(

          `[Group-Chat] From: ${username}, No: ${

            sender.split("@")[0]

          }, Group: ${groupName}, Text: ${command}`

        );

      }

      //private chat

      if (isCmd && !isGroup) {

        console.log(

          `[Private-Chat] From: ${username}, No: ${

            sender.split("@")[0]

          }, Text: ${command}`

        );

      }

      switch (command) {

        case "help":

          listhelp = `Simple Bot WA Economy

Prefix: ${prefix}

Command:

${prefix}join

${prefix}profile

${prefix}daily 

${prefix}work

${prefix}balance/bal

${prefix}leaderboard/lb

${prefix}pay [tag] [amount]

${prefix}deposit/dep [all/amout]

${prefix}withdraw/wd [all/amount]

${prefix}gamble/gb [amount]

${prefix}qq [amount]

${prefix}shop

${prefix}buy [item]

Owner Command:

${prefix}add [amount] (to add owner money)

${prefix}addmoney [tag] [amount]

Other:

${prefix}about`;

          client.sendMessage(from, listhelp, text, {

            quoted: sen,

          });

          break;

        //jangan di hapus bro!

        case "about":

          client.sendMessage(

            from,

            "Bot ini di buat oleh Jesen N#9071, jika kamu ingin menggunakan bot ini klik saja link yang ada di bawah!\nLink: https://github.com/Jesen-N/termux-wabot-economy",

            text,

            {

              quoted: sen,

            }

          );

          break;

        case "join":

          if (isJoin)

            return client.sendMessage(from, "Kamu Sudah Register!", text, {

              quoted: sen,

            });

          join.push(sender);

          fs.writeFileSync("./data/join.json", JSON.stringify(join));

          client.sendMessage(from, "Kamu Berhasil Register!", text, {

            quoted: sen,

          });

          break;

        case "daily":

          if (!isJoin)

            return client.sendMessage(

              from,

              `Kamu belum register! ketik ${prefix}join`,

              text,

              {

                quoted: sen,

              }

            );

          let dailytimeout = 86400000;

          let dailyamount = 10000;

          let daily = await db.fetch(`daily_${sender}`);

          if (daily !== null && dailytimeout - (Date.now() - daily) > 0) {

            let dailytime = ms(dailytimeout - (Date.now() - daily));

            client.sendMessage(

              from,

              `Tunggu Cooldown ${dailytime.hours} jam ${dailytime.minutes} menit, ${dailytime.seconds} detik`,

              text,

              {

                quoted: sen,

              }

            );

          } else {

            client.sendMessage(

              from,

              `Kamu memggunakan harian dan mendapatkan ${dailyamount} uang!`,

              text,

              {

                quoted: sen,

              }

            );

            db.add(`uang_${sender}`, dailyamount);

            db.set(`daily_${sender}`, Date.now());

          }

          break;

        case "work":

          if (!isJoin)

            return client.sendMessage(

              from,

              `Kamu belum register! ketik ${prefix}join`,

              text,

              {

                quoted: sen,

              }

            );

          let orang = await db.fetch(`kerja_${sender}`);

          let timeout = 5000;

          if (orang !== null && timeout - (Date.now() - orang) > 0) {

            let time = ms(timeout - (Date.now() - orang));

            client.sendMessage(

              from,

              `Tunggu Cooldown ${time.minutes} menit, ${time.seconds} detik`,

              text,

              {

                quoted: sen,

              }

            );

          } else {

            let pekerjaan = [

              "Nguli",

              "Ngemis",

              "Pilot",

              "Hunter",

              "Peternak",

              "Polisi",

              "Dokter",

            ]; //bisa di add lagi

            let result = Math.floor(Math.random() * pekerjaan.length);

            let gaji = Math.floor(Math.random() * 2000);

            client.sendMessage(

              from,

              `Nama: ${username}\nKamu bekerja sebagai ${pekerjaan[result]} dan mendapatkan *${gaji} uang*`,

              text,

              {

                quoted: sen,

              }

            );

            db.add(`uang_${sender}`, gaji);

            db.set(`kerja_${sender}`, Date.now());

          }

          break;

        case "bal":

        case "balance":

          if (!isJoin)

            return client.sendMessage(

              from,

              `Kamu belum register! ketik ${prefix}join`,

              text,

              {

                quoted: sen,

              }

            );

          let selfbal = db.fetch(`uang_${sender}`);

          let selfbank = db.fetch(`bank_${sender}`);

          if (selfbal === null) selfbal = 0;

          if (selfbank === null) selfbank = 0;

          if (

            sen.message.extendedTextMessage === undefined ||

            sen.message.extendedTextMessage === null

          ) {

            client.sendMessage(

              from,

              `Nama: ${username}\nUang: *${selfbal.toLocaleString()}*\nBank: *${selfbank.toLocaleString()}*`,

              text,

              {

                quoted: sen,

              }

            );

          } else {

            let mentioned1 =

              sen.message.extendedTextMessage.contextInfo.mentionedJid[0];

            if (!mentioned1)

              return client.sendMessage(

                from,

                `Nama: ${username}\nUang: *${selfbal.toLocaleString()}*\nBank: *${selfbank.toLocaleString()}*`,

                text,

                {

                  quoted: sen,

                }

              );

            let bankmen = groupMembers.find((x) => x.jid === mentioned1);

            let notselfbal = db.fetch(`uang_${bankmen.jid}`);

            let notselfbank = db.fetch(`bank_${bankmen.jid}`);

            if (notselfbal === null) notselfbal = 0;

            if (notselfbank === null) notselfbank = 0;

            client.sendMessage(

              from,

              `Nama: @${

                bankmen.id.split("@")[0]

              }\nUang: *${notselfbal.toLocaleString()}*\nBank: *${notselfbank.toLocaleString()}*`,

              extendedText,

              {

                quoted: sen,

                contextInfo: {

                  mentionedJid: [bankmen.jid],

                },

              }

            );

          }

          break;

        case "pay":

          if (!isJoin)

            return client.sendMessage(

              from,

              `Kamu belum register! ketik ${prefix}join`,

              text,

              {

                quoted: sen,

              }

            );

          let payuang = db.fetch(`uang_${sender}`);

          let payamount = args[1];

          if (

            sen.message.extendedTextMessage === undefined ||

            sen.message.extendedTextMessage === null

          )

            return client.sendMessage(

              from,

              "Tag seseorang yang ingin kamu pay",

              text

            );

          let mentionedpay =

            sen.message.extendedTextMessage.contextInfo.mentionedJid[0];

          if (!payamount)

            return client.sendMessage(from, "Masukan jumlah uangnya!", text, {

              quoted: sen,

            });

          if (isNaN(payamount))

            return client.sendMessage(from, "Harus berupa angka!", text, {

              quoted: sen,

            });

          if (body.includes("-") || body.includes("+"))

            return client.sendMessage(from, "Terdapat simbol negatif!", text, {

              quoted: sen,

            });

          if (payuang == 0)

            return client.sendMessage(from, "Uang kamu tidak ada!", text, {

              quoted: sen,

            });

          if (payuang < payamount) {

            return client.sendMessage(from, "Uang kamu tidak cukup!", text, {

              quoted: sen,

            });

          }

          let paymen = groupMembers.find((x) => x.jid === mentionedpay);

          if (!join.includes(paymen.jid)) {

            client.sendMessage(

              from,

              "Username tidak ada dalam daftar register!",

              text,

              {

                quoted: sen,

              }

            );

          } else {

            client.sendMessage(

              from,

              `Kamu Berhasil Memberikan @${

                paymen.jid.split("@")[0]

              } ${payamount} Uang!`,

              extendedText,

              {

                quoted: sen,

                contextInfo: {

                  mentionedJid: [paymen.jid],

                },

              }

            );

          }

          db.add(`uang_${paymen.jid}`, payamount);

          db.subtract(`uang_${sender}`, payamount);

          break;

        case "deposit":

        case "dep":

          if (!isJoin)

            return client.sendMessage(

              from,

              `Kamu belum register! ketik ${prefix}join`,

              text,

              {

                quoted: sen,

              }

            );

          if (body.includes("-") || body.includes("+"))

            return client.sendMessage(from, "Terdapat simbol negatif!", text, {

              quoted: sen,

            });

          if (args[0] === "all") {

            let uangdepo = await db.fetch(`uang_${sender}`);

            if (uangdepo === 0)

              return client.sendMessage(from, "Kamu tidak ada uang!", text, {

                quoted: sen,

              });

            client.sendMessage(

              from,

              "Kamu berhasil mendeposit semua uang ke bank!",

              text,

              {

                quoted: sen,

              }

            );

            db.add(`bank_${sender}`, uangdepo);

            db.subtract(`uang_${sender}`, uangdepo);

          } else {

            if (!args[0])

              return client.sendMessage(from, "Masukan jumlahnya!", text, {

                quoted: sen,

              });

            if (isNaN(args[0]))

              return client.sendMessage(from, "Harus berupa angka!", text, {

                quoted: sen,

              });

            let uangdepo1 = db.fetch(`uang_${sender}`);

            if (uangdepo1 < args[0])

              return client.sendMessage(from, "Uang kamu tidak cukup!", text, {

                quoted: sen,

              });

            client.sendMessage(

              from,

              `Kamu berhasil mendeposit uang ke bank senilai ${args[0]}!`,

              text,

              {

                quoted: sen,

              }

            );

            db.add(`bank_${sender}`, args[0]);

            db.subtract(`uang_${sender}`, args[0]);

          }

          break;

        case "wd":

        case "withdraw":

          if (!isJoin)

            return client.sendMessage(

              from,

              `Kamu belum register! ketik ${prefix}join`,

              text,

              {

                quoted: sen,

              }

            );

          if (body.includes("-") || body.includes("+"))

            return client.sendMessage(from, "Terdapat simbol negatif!", text, {

              quoted: sen,

            });

          if (args[0] === "all") {

            let uangwith = db.fetch(`bank_${sender}`);

            if (uangwith === 0)

              return client.sendMessage(

                from,

                "Kamu tidak ada uang di bank!",

                text,

                {

                  quoted: sen,

                }

              );

            client.sendMessage(

              from,

              "Kamu berhasil mengambil semua uang dari bank!",

              text,

              {

                quoted: sen,

              }

            );

            db.add(`uang_${sender}`, uangwith);

            db.subtract(`bank_${sender}`, uangwith);

          } else {

            if (!args[0])

              return client.sendMessage(from, "Masukan jumlahnya!", text, {

                quoted: sen,

              });

            if (isNaN(args[0]))

              return client.sendMessage(from, "Harus berupa angka!", text, {

                quoted: sen,

              });

            let uangwith1 = db.fetch(`bank_${sender}`);

            if (uangwith1 < args[0])

              return client.sendMessage(

                from,

                "Uang kamu di bank tidak cukup!",

                text,

                {

                  quoted: sen,

                }

              );

            client.sendMessage(

              from,

              `Kamu berhasil mengambil uang dari bank senilai ${args[0]}!`,

              text,

              {

                quoted: sen,

              }

            );

            db.add(`uang_${sender}`, args[0]);

            db.subtract(`bank_${sender}`, args[0]);

          }

          break;

        case "lb":

        case "leaderboard":

          if (!isJoin)

            return client.sendMessage(

              from,

              `Kamu belum register! ketik ${prefix}join`,

              text,

              {

                quoted: sen,

              }

            );

          var lbno = 1;

          let lbuser2 = [];

          let lblast = [];

          let lbmax = 10;

          let lbpe = 0;

          for (let i = 0; i < join.length; i++) {

            let lbuang = db.fetch(`uang_${join[i]}`);

            lbuser2.push({

              name: join[i],

              money: lbuang,

            });

          }

          lbuser2.sort((a, b) => b.money - a.money);

          for (let i = 0; i < lbuser2.length; i++) {

            lbpe++;

            if (lbpe >= lbmax) continue;

            if (lbuser2[i].money == null) lbuser2[i].money = 0;

            if (lbuser2[i].money < 100000) continue;

            lblast.push(

              `${lbno++}. @${lbuser2[i].name.split("@")[0]} - *${lbuser2[

                i

              ].money.toLocaleString()} Uang*`

            );

          }

          client.sendMessage(

            from,

            `Global Leaderboard\n\n${lblast.join(

              "\n"

            )}\n\nMoney smaller than 100,000 will not appear.`,

            extendedText,

            {

              quoted: sen,

              contextInfo: {

                mentionedJid: join,

              },

            }

          );

          break;

        case "gamble":

        case "gb":

          if (!isJoin)

            return client.sendMessage(

              from,

              `Kamu belum register! ketik ${prefix}join`,

              text,

              {

                quoted: sen,

              }

            );

          let gamorang = await db.fetch(`gamble_${sender}`);

          let gamtimeout = 10000;

          if (gamorang !== null && gamtimeout - (Date.now() - gamorang) > 0) {

            let gamtime = ms(gamtimeout - (Date.now() - gamorang));

            client.sendMessage(

              from,

              `Tunggu Cooldown ${gamtime.minutes} menit, ${gamtime.seconds} detik`,

              text,

              {

                quoted: sen,

              }

            );

          } else {

            let gamuang = db.fetch(`uang_${sender}`);

            var gamnum = parseInt(args[0]);

            if (!gamnum)

              return client.sendMessage(

                from,

                `Tolong masukan jumlah uangnya!`,

                text,

                {

                  quoted: sen,

                }

              );

            if (body.includes("-") || body.includes("+"))

              return client.sendMessage(

                from,

                "Terdapat simbol negatif!",

                text,

                {

                  quoted: sen,

                }

              );

            if (gamnum > 50000)

              return client.sendMessage(

                from,

                `Maksimal hanya 50000 uang!`,

                text,

                {

                  quoted: sen,

                }

              );

            if (gamuang < gamnum)

              return client.sendMessage(from, `Kamu tidak ada uang!`, text, {

                quoted: sen,

              });

            if (gamrand === 1) {

              client.sendMessage(

                from,

                `Kamu menang dan mendapatkan *${gamnum * 2}* uang!`,

                text,

                {

                  quoted: sen,

                }

              );

              db.add(`uang_${sender}`, gamnum * 2);

              db.set(`gamble_${sender}`, Date.now());

            } else {

              client.sendMessage(

                from,

                `Kamu kalah dan kehilangan *${gamnum}* uang...`,

                text,

                {

                  quoted: sen,

                }

              );

              db.subtract(`uang_${sender}`, gamnum);

              db.set(`gamble_${sender}`, Date.now());

            }

          }

          break;

        case "qq":

          if (!isJoin)

            return client.sendMessage(

              from,

              `Kamu belum register! ketik ${prefix}join`,

              text,

              {

                quoted: sen,

              }

            );

          let qqccd = await db.fetch(`qq_${sender}`);

          let qqcd = 10000;

          if (qqccd !== null && qqcd - (Date.now() - qqccd) > 0) {

            let qqcccd = ms(qqcd - (Date.now() - qqccd));

            client.sendMessage(

              from,

              `Tunggu Cooldown ${qqcccd.minutes} menit, ${qqcccd.seconds} detik`,

              text,

              {

                quoted: sen,

              }

            );

          } else {

            let qqtext = "";

            let qquang = db.fetch(`uang_${sender}`);

            var qqnum = parseInt(args[0]);

            let qqrand = Math.floor(Math.random() * 50);

            let qqbot = Math.floor(Math.random() * 50);

            let qqrand2 = qqrand % 10;

            let qqbot2 = qqbot % 10;

            if (!qqnum)

              return client.sendMessage(

                from,

                `Tolong masukan jumlah uangnya!`,

                text,

                {

                  quoted: sen,

                }

              );

            if (body.includes("-") || body.includes("+"))

              return client.sendMessage(

                from,

                "Terdapat simbol negatif!",

                text,

                {

                  quoted: sen,

                }

              );

            if (qquang < qqnum)

              return client.sendMessage(from, `Kamu tidak ada uang!`, text, {

                quoted: sen,

              });

            if (qqrand2 === 0) {

              qqtext = `Jackpot!, Kamu menang dan mendapatkan *${(

                qqnum * 2

              ).toLocaleString()}* uang!`;

              db.add(`uang_${sender}`, qqnum * 2);

            } else if (qqbot2 === 0) {

              qqtext = `Bot Jackpot!, Kamu kalah dan kehilangan *${qqnum.toLocaleString()}* uang...`;

              db.subtract(`uang_${sender}`, qqnum);

            } else if (qqrand2 === qqbot2) {

              qqtext = "Hasil seri, tidak ada yang menang...";

            } else if (qqrand2 > qqbot2) {

              qqtext = `Kamu menang dan mendapatkan *${(

                qqnum * 2

              ).toLocaleString()}* uang!`;

              db.add(`uang_${sender}`, qqnum * 2);

            } else if (qqrand2 < qqbot2) {

              qqtext = `Kamu kalah dan kehilangan *${qqnum.toLocaleString()}* uang...`;

              db.subtract(`uang_${sender}`, qqnum);

            }

            client.sendMessage(

              from,

              `Bot spin the wheel and get *${qqbot}* 

You spin the wheel and get *${qqrand}* 

${qqtext}`,

              text,

              {

                quoted: sen,

              }

            );

            db.set(`qq_${sender}`, Date.now());

          }

          break;

        case "add":

          if (!isJoin)

            return client.sendMessage(

              from,

              `Kamu belum register! ketik ${prefix}join`,

              text,

              {

                quoted: sen,

              }

            );

          if (!isOwner)

            return client.sendMessage(from, "Kamu bukan owner bot!", text, {

              quoted: sen,

            });

          let amountadd = args[0];

          if (!amountadd)

            return client.sendMessage(from, `Masukan jumlah uangnya!`, text, {

              quoted: sen,

            });

          client.sendMessage(

            from,

            `Berhasil menambahkan ${amountadd} uang!`,

            text,

            {

              quoted: sen,

            }

          );

          db.add(`uang_${sender}`, amountadd);

          break;

        case "addmoney":

          if (!isJoin)

            return client.sendMessage(

              from,

              `Kamu belum register! ketik ${prefix}join`,

              text,

              {

                quoted: sen,

              }

            );

          if (!isOwner)

            return client.sendMessage(from, "Kamu bukan owner bot!", text, {

              quoted: sen,

            });

          let addmarg = args[1];

          if (

            sen.message.extendedTextMessage === undefined ||

            sen.message.extendedTextMessage === null

          )

            return client.sendMessage(

              from,

              "Tag seseorang yang ingin kamu berikan uang!",

              text

            );

          if (!addmarg)

            return client.sendMessage(

              from,

              "Tolong masukan jumlah uangnya!",

              text,

              {

                quoted: sen,

              }

            );

          if (isNaN(addmarg))

            return client.sendMessage(from, "Harus berupa angka!", text, {

              quoted: sen,

            });

          if (body.includes("-") || body.includes("+"))

            return client.sendMessage(from, "Terdapat simbol negatif!", text, {

              quoted: sen,

            });

          if (!addmarg)

            return client.sendMessage(from, "Masukan jumlah uang nya!", text, {

              quoted: sen,

            });

          let mentioned2 =

            sen.message.extendedTextMessage.contextInfo.mentionedJid[0];

          let adm = groupMembers.find((y) => y.jid === mentioned2);

          if (!join.includes(adm.jid)) {

            client.sendMessage(

              from,

              "Username tidak ada dalam daftar register!",

              text,

              {

                quoted: sen,

              }

            );

          } else {

            client.sendMessage(

              from,

              `Berhasil Memberikan @${adm.jid.split("@")[0]} ${addmarg} Uang`,

              extendedText,

              {

                quoted: sen,

                contextInfo: {

                  mentionedJid: [adm.jid],

                },

              }

            );

            db.add(`uang_${adm.jid}`, addmarg);

          }

          break;

        case "shop":

          if (!isJoin)

            return client.sendMessage(

              from,

              `Kamu belum register! ketik ${prefix}join`,

              text,

              {

                quoted: sen,

              }

            );

          client.sendMessage(

            from,

            `Bot Shop

How to buy? ${prefix}buy <item>

Item:

1. sword

Cooldown: --

Desc: You can get more money than 5.000

Price: 500.000

2. coming soon..`,

            text,

            {

              quoted: sen,

            }

          );

          break;

        case "buy":

          if (!isJoin)

            return client.sendMessage(

              from,

              `Kamu belum register! ketik ${prefix}join`,

              text,

              {

                quoted: sen,

              }

            );

          if (!args[0])

            return client.sendMessage(from, "Masukan nama item nya!", text, {

              quoted: sen,

            });

          if (args[0] === "sword") {

            let sword = db.fetch(`sword_b_${sender}`);

            let suang = db.fetch(`uang_${sender}`);

            if (suang < 500000)

              return client.sendMessage(from, "Uang kamu tidak cukup!", text, {

                quoted: sen,

              });

            if (sword)

              return client.sendMessage(

                from,

                "Kamu sudah membeli item sword!",

                text,

                {

                  quoted: sen,

                }

              );

            client.sendMessage(

              from,

              `Kamu membeli sword seharga 500.000 uang!\ncara pakai: ${prefix}use sword`,

              text,

              {

                quoted: sen,

              }

            );

            db.add(`sword_b_${sender}`, 1);

            db.subtract(`uang_${sender}`, 500000);

          }

          break;

        case "use":

          if (!isJoin)

            return client.sendMessage(

              from,

              `Kamu belum register! ketik ${prefix}join`,

              text,

              {

                quoted: sen,

              }

            );

          let sresult = Math.floor(Math.random() * 7000) + 5000;

          let suse = await db.fetch(`use_${sender}`);

          let stimeout = 10000;

          if (suse !== null && stimeout - (Date.now() - suse) > 0) {

            let stime = ms(stimeout - (Date.now() - suse));

            client.sendMessage(

              from,

              `Tunggu Cooldown ${stime.minutes} menit, ${stime.seconds} detik`,

              text,

              {

                quoted: sen,

              }

            );

          } else {

            let usword = db.fetch(`sword_b_${sender}`);

            if (args[0] === "sword") {

              if (usword === 0)

                return client.sendMessage(from, "Kamu tidak ada sword!", text, {

                  quoted: sen,

                });

              client.sendMessage(

                from,

                `Kamu menggunakan sword dan mendapatkan ${sresult} uang!`,

                text,

                {

                  quoted: sen,

                }

              );

              db.add(`uang_${sender}`, sresult);

              db.subtract(`sword_b_${sender}`, 0);

              db.set(`use_${sender}`, Date.now());

            }

          }

          break;

        case "profile":

          if (!isJoin)

            return client.sendMessage(

              from,

              `Kamu belum register! ketik ${prefix}join`,

              text,

              {

                quoted: sen,

              }

            );

          let swordp = db.fetch(`sword_b_${sender}`);

          if (swordp === 1) swordp = "✅";

          if (swordp === null) swordp = "-";

          client.sendMessage(

            from,

            `Nama: ${username}\n\nItem yang terpakai:\nSword: ${swordp}`,

            text,

            {

              quoted: sen,

            }

          );

          break;

      }

    } catch (err) {

      console.log(err);

    }

  });

}

start();

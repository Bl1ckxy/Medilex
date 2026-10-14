function normalize(c){return c.toLowerCase().replace(/\s+/g,' ').trim();}
function match(candidate,retrieved){const nc=normalize(candidate),nr=normalize(retrieved);return nr.includes(nc)||nc===nr||(nc.length>=3&&nr.includes(nc));}
console.log('CPA s.69==chunk:', match('Consumer Protection Act, 2019, s.69','Consumer Protection Act, 2019, s.69'));
console.log('D\'Souza==chunk:', match("Martin F. D'Souza v. Mohd. Ishfaq, (2009) 4 SCC 386","Martin F. D'Souza v. Mohd. Ishfaq, (2009) 4 SCC 386"));
console.log('s.69 in chunk:', match('s.69','Consumer Protection Act, 2019, s.69'));

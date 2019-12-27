const fetch = require('node-fetch');

async function makeRequest (url, headers) {
    const res = await fetch(url, headers);
    return new Promise((resolve, reject) => {
        if(res.ok) resolve(res.text());
        else reject(new Error(res.statusText));
    })
}

module.exports = {
    makeRequest,
};
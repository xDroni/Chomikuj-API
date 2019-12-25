const fetch = require('node-fetch');
const cheerio = require('cheerio');
const fs = require('fs');

const hamster = {
    makeRequest: async (url, headers) => {
        const res = await fetch(url, headers);
        return new Promise((resolve, reject) => {
            if(res.status === 200) resolve(res.json());
            else reject(res.statusText);
        })

    },

    getLastSeen: count => {
        const url = `http://chomikuj.pl/action/LastAccounts/LastSeen?itemsCount=${count}`;
        const headers = {
            'headers': {
                'x-requested-with': 'XMLHttpRequest'
            },
            'method': 'GET'
        };

        return hamster.makeRequest(url, headers)
            .then(res => {
                    const $ = cheerio.load(res.Data, {normalizeWhitespace: true});
                    return $('p[class="avatarNickname"]').map((i, e) => $(e).text()).get();
                }
            )
            .catch(err => console.error(err));
    }
};

(async () => {
    hamster.getLastSeen(100)
        .then(res => console.log(res))
        .catch(err => console.log(err));
})();


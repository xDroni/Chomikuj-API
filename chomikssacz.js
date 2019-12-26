const fetch = require('node-fetch');
const cheerio = require('cheerio');
const fs = require('fs');

const auth = JSON.parse(fs.readFileSync('auth.json').toString()); // read json file with cookie and token

async function makeRequest (url, headers) {
    const res = await fetch(url, headers);
    return new Promise((resolve, reject) => {
        if(res.ok) resolve(res.text());
        else reject(new Error(res.statusText));
    })
}

const hamster = {
    getLastSeen: count => {
        const url = `http://chomikuj.pl/action/LastAccounts/LastSeen?itemsCount=${count}`;
        const headers = {
            'headers': {
                'x-requested-with': 'XMLHttpRequest'
            },
            'method': 'GET'
        };

        return makeRequest(url, headers)
            .then(res => {
                const $ = cheerio.load(res.Data, {normalizeWhitespace: true});
                return $('p[class="avatarNickname"]').map((i, e) => $(e).text()).get();

            })
            // .catch(err => console.error(err));
    },

    login: () => {
        const url = 'http://chomikuj.pl/action/Login/TopBarLogin';
        const data = {
            Login: '',
            Password: '',
        };
        const headers = {
            headers: {
                'cookie': '',
                "content-type": 'application/x-www-form-urlencoded',
                'x-requested-with': 'XMLHttpRequest'
            },
            body: `Login=${data.Login}&Password=${data.Password}`,
            method: 'POST'
        };
        makeRequest(url, headers).then(res => console.log(res));
    },

    copyFile: (chomikName, folderId, fileId, folderTo) => {
        const url = 'http://chomikuj.pl/action/FileDetails/CopyFileAction';
        const headers = {
            headers: {
                'cookie': auth.cookie,
                "content-type": 'application/x-www-form-urlencoded',
                'x-requested-with': 'XMLHttpRequest'
            },
            body: `ChomikName=${chomikName}&FolderId=${folderId}&FileId=${fileId}&FolderTo=${folderTo}&__RequestVerificationToken=${auth.token}`,
            method: 'POST'
        };
        return makeRequest(url, headers);
    },

    getFilesIds: async (chomikName, folderId) => {
        const url = 'http://chomikuj.pl/action/Files/FilesList';
        const headers = {
            headers: {
                'cookie': auth.cookie,
                'content-type': 'application/x-www-form-urlencoded',
                'x-requested-with': 'XMLHttpRequest'
            },
            body: `ChomikName=${chomikName}&FolderId=${folderId}&__RequestVerificationToken=${auth.token}`,
            method: 'POST'
        };
        return makeRequest(url, headers)
            .then(html => {
                const $ = cheerio.load(html);
                return $('input[name="selectFileItem"]').map((i, e) => $(e).attr('value')).get();
            });
    },

    changeFileName: (fileId, name) => {
        const url = 'http://chomikuj.pl/action/FileDetails/EditNameAndDescAction';
        const headers = {
            headers: {
                'cookie': auth.cookie,
                'content-type': 'application/x-www-form-urlencoded',
                'x-requested-with': 'XMLHttpRequest'
            },
            body: `FileId=${fileId}&Name=${name}&__RequestVerificationToken=${auth.token}`,
            method: 'POST'
        };

        return makeRequest(url, headers);
    }
};

(async () => {
    async function  getFilesIds() {
        return hamster.getFilesIds('', '')
    }

    async function changeNames(name) {
        const ids = await getFilesIds();
        for(let id of ids) {
            await hamster.changeFileName(id, name).catch(err => console.log(err));
        }
    }

    await changeNames('');

    async function copyFiles() {
        /* Copy file */
        let promises = [];
        for(let i = 0; i<10; i++) promises.push(hamster.copyFile());

        const results = await Promise.all(promises.map(p => p.catch(e => e)));
        const errors = results.filter(r => (r instanceof Error));console.log(results);
    }

    function getLastSeen() {
        hamster.getLastSeen(100)
            .then(res => console.log(res))
            .catch(err => console.error(err));
    }


})();
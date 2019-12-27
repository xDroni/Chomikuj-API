const cheerio = require('cheerio');
const fs = require('fs');
const { makeRequest } = require('./common');

const auth = JSON.parse(fs.readFileSync('auth.json').toString()); // read json file with cookie and token

const headers = {
    'cookie': auth.cookie,
    'content-type': 'application/x-www-form-urlencoded',
    'x-requested-with': 'XMLHttpRequest'
};

const hamster = {
    getLastSeen: count => {
        const url = `http://chomikuj.pl/action/LastAccounts/LastSeen?itemsCount=${count}`;
        const _headers = {
            headers,
            'method': 'GET'
        };

        return makeRequest(url, _headers)
            .then(res => res.json())
            .then(res => {
                const $ = cheerio.load(res.Data, {normalizeWhitespace: true});
                return $('p[class="avatarNickname"]').map((i, e) => $(e).text()).get();
            })
    },

    login: (login, password) => {
        const url = 'http://chomikuj.pl/action/Login/TopBarLogin';
        const _headers = {
            headers,
            body: `Login=${login}&Password=${password}`,
            method: 'POST'
        };

        return makeRequest(url, _headers)
            .then(res => {
                const cookieRaw = res.headers.raw()['set-cookie'];
                const cookieString = cookieRaw.map(e => e.split(' ')[0]).join(' ');
                const cookie = {
                    cookie: cookieString
                };
                fs.writeFileSync('auth.json', JSON.stringify(cookie, null,2));
                return res.text();
            })
    },

    copyFile: (chomikName, folderId, fileId, folderTo) => {
        const url = 'http://chomikuj.pl/action/FileDetails/CopyFileAction';
        const _headers = {
            headers,
            body: `ChomikName=${chomikName}&FolderId=${folderId}&FileId=${fileId}&FolderTo=${folderTo}`,
            method: 'POST'
        };

        return makeRequest(url, _headers).then(res => {
            return res.json()
        });
    },

    getFolderIdFromName: (chomikName, folderName) => {
        const url = 'http://chomikuj.pl/action/tree/loadtree';
        const _headers = {
            headers,
            body: `ChomikName=${chomikName}&FolderId=0&__RequestVerificationToken=${auth.token}`,
            method: 'POST'
        };

        return makeRequest(url, _headers)
            .then(res => res.text())
            .then(html => {
                const $ = cheerio.load(html);
                return $(`.accountTree a[title="${folderName}"]`).map((i, e) => $(e).attr('rel')).get();
            });
    },

    getFilesIdsFromFolder: async (chomikName, folderId, pageNr = 1) => {
        const url = 'http://chomikuj.pl/action/Files/FilesList';
        const _headers = {
            headers,
            body: `ChomikName=${chomikName}&FolderId=${folderId}&PageNr=${pageNr}&__RequestVerificationToken=${auth.token}`,
            method: 'POST'
        };

        return makeRequest(url, _headers)
            .then(res => res.text())
            .then(html => {
                const $ = cheerio.load(html);
                return $('input[name="selectFileItem"]').map((i, e) => $(e).attr('value')).get();
            });
    },

    getAllFilesIdsFromFolder: async (chomikName, folderId) => {
        const url = 'http://chomikuj.pl/action/Files/FilesList';
        const _headers = {
            headers,
            body: `ChomikName=${chomikName}&FolderId=${folderId}&__RequestVerificationToken=${auth.token}`,
            method: 'POST'
        };

        const pages = await makeRequest(url, _headers)
            .then(res => res.text())
            .then(html => {
                const $ = cheerio.load(html);
                const filesCount = $('.fileInfoSmallFrame > p > span:nth-child(1)').text();
                return Math.ceil(filesCount / 30);
            });

        let promises = [];
        for(let i = 1; i<=pages; i++) {
            promises.push(hamster.getFilesIdsFromFolder(chomikName, folderId, i));
        }

        const result = await Promise.all(promises);
        return result.flat();
    },

    changeFileName: (fileId, name) => {
        const url = 'http://chomikuj.pl/action/FileDetails/EditNameAndDescAction';
        const _headers = {
            headers,
            body: `FileId=${fileId}&Name=${name}`,
            method: 'POST'
        };

        return makeRequest(url, _headers).then(res => res.text());
    }
};

module.exports = hamster;
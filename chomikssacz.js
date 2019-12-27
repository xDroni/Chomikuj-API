const cheerio = require('cheerio');
const fs = require('fs');
const { makeRequest } = require('./common');

const auth = JSON.parse(fs.readFileSync('auth.json').toString()); // read json file with cookie and token

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

    getFolderIdFromName: (chomikName, folderName) => {
        const url = 'http://chomikuj.pl/action/tree/loadtree';
        const headers = {
            headers: {
                'cookie': auth.cookie,
                "content-type": 'application/x-www-form-urlencoded',
                'x-requested-with': 'XMLHttpRequest'
            },
            body: `ChomikName=${chomikName}&FolderId=0&__RequestVerificationToken=${auth.token}`,
            method: 'POST'
        };
        return makeRequest(url, headers)
            .then(html => {
                const $ = cheerio.load(html);
                return $(`.accountTree a[title="${folderName}"]`).map((i, e) => $(e).attr('rel')).get();
            });
    },

    getFilesIdsFromFolder: async (chomikName, folderId, pageNr = 1) => {
        const url = 'http://chomikuj.pl/action/Files/FilesList';
        const headers = {
            headers: {
                'cookie': auth.cookie,
                'content-type': 'application/x-www-form-urlencoded',
                'x-requested-with': 'XMLHttpRequest'
            },
            body: `ChomikName=${chomikName}&FolderId=${folderId}&PageNr=${pageNr}&__RequestVerificationToken=${auth.token}`,
            method: 'POST'
        };
        return makeRequest(url, headers)
            .then(html => {
                const $ = cheerio.load(html);
                return $('input[name="selectFileItem"]').map((i, e) => $(e).attr('value')).get();
            });
    },

    getAllFilesIdsFromFolder: async (chomikName, folderId) => {
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

        const pages = await makeRequest(url, headers)
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

module.exports = hamster;
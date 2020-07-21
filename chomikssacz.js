const cheerio = require('cheerio');
const fs = require('fs');
const {makeRequest} = require('./common');

const auth = JSON.parse(fs.readFileSync('auth.json').toString()); // read json file with cookie and token

const headers = {
    'cookie': auth.cookie,
    'content-type': 'application/x-www-form-urlencoded',
    'x-requested-with': 'XMLHttpRequest'
};

const hamster = {
    login: async (login, password) => {
        /* Getting the cookie from login request */
        const loginRequestUrl = `http://chomikuj.pl/action/Login/TopBarLogin?login=${login}&password=${password}`;

        const _headers = {
            headers,
            'method': 'POST'
        };

        const loginResponse = await makeRequest(loginRequestUrl, _headers);
        const loginResponseJson = await loginResponse.json();
        console.log(loginResponseJson);
        const cookie = loginResponse.headers.get('set-cookie');
        _headers.cookie = cookie;
        console.log('Cookies saved successfully');

        /* Getting the token*/
        const tokenResponse = await makeRequest('http://chomikuj.pl/', _headers);
        const tokenResponseText = await tokenResponse.text();

        const $ = cheerio.load(tokenResponseText);
        const token = $('input[name="__RequestVerificationToken"]').attr('value');
        console.log(token);

        const auth = {
            cookie,
            token
        };

        console.log('Saving the cookies and token');
        fs.writeFileSync('auth.json', JSON.stringify(auth, null, 2));
        console.log('Saved!');

        return 'Logged in successfully';
    },

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
            });
    },

    createFolder: (chomikName, folderId, folderName, adultContent = false, password = '') => {
        if (headers.cookie.length === 0) throw Error('No cookie, login first');
        const url = 'https://chomikuj.pl/action/FolderOptions/NewFolderAction';
        const _headers = {
            headers,
            body: `FolderId=${folderId}&ChomikName=${chomikName}&FolderName=${folderName}&AdultContent=${adultContent}&Password=${password}&__RequestVerificationToken=${auth.token}`,
            method: 'POST'
        };

        return makeRequest(url, _headers)
            .then(res => res.json())
            .then(json => {
                if (json.Data !== null && json.Data.Status === 0) {
                    return json.Content;
                } else {
                    const $ = cheerio.load(json.Content);
                    if (json.Data !== null) return $('.errorText').text().trim();
                    else return $('div').text().trim();
                }
            }).catch(err => {
                console.error(err);
            });
    },

    copyFile: (chomikName, fileId, folderTo) => {
        if (headers.cookie.length === 0) throw Error('No cookie, login first');
        const url = 'http://chomikuj.pl/action/FileDetails/CopyFileAction';
        const _headers = {
            headers,
            body: `ChomikName=${chomikName}&FileId=${fileId}&FolderTo=${folderTo}`,
            method: 'POST'
        };

        return makeRequest(url, _headers)
            .then(res => res.json())
            .then(json => {
                if (json.Data !== null && json.Data.Status === 'OK') {
                    return json.Content;
                } else {
                    const $ = cheerio.load(json.Content);
                    if (json.Data !== null) return json.Content.trim();
                    else return $('div').text().trim();
                }
            });
    },

    getFolderIdFromName: (chomikName, folderName) => {
        const url = 'http://chomikuj.pl/action/tree/loadtree';
        const _headers = {
            headers,
            body: `ChomikName=${chomikName}&__RequestVerificationToken=${auth.token}`,
            method: 'POST'
        };

        return makeRequest(url, _headers)
            .then(res => res.text())
            .then(html => {
                const $ = cheerio.load(html);
                return $(`.accountTree a[title="${folderName}"]`).map((i, e) => $(e).attr('rel')).get();
            });
    },

    getAllFoldersNames: (chomikName) => {
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
                return $('.accountTree a').map((i, e) => $(e).text()).get();
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
                return $('div.fileIdContainer').map((i, e) => $(e).attr('rel')).get();
            });
    },

    getAllFilesIdsFromFolder: async (chomikName, folderId) => {
        if (headers.cookie.length === 0) throw Error('No cookie, login first');
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
        for (let i = 1; i <= pages; i++) {
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

        return makeRequest(url, _headers)
            .then(res => res.json())
            .then(json => {
                if (json.Data !== null && json.Data.Status === 'OK') {
                    return json.Content;
                } else {
                    const $ = cheerio.load(json.Content);
                    if (json.Data !== null) return $('div.validation-summary-errors').text();
                    else return $('div').text().trim();
                }
            });
    }
};

module.exports = hamster;
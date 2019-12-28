const cheerio = require('cheerio');
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const { makeRequest } = require('./common');

const auth = JSON.parse(fs.readFileSync('auth.json').toString()); // read json file with cookie and token

const headers = {
    'cookie': auth.cookie,
    'content-type': 'application/x-www-form-urlencoded',
    'x-requested-with': 'XMLHttpRequest'
};

const hamster = {
    login: async (login, password, path = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe') => {
        console.log('Launching the browser in headless mode');
        const browser = await puppeteer.launch({
            executablePath: path
        });

        const page = await browser.newPage();
        console.log('Opening login page');
        await page.goto(`http://chomikuj.pl/${login}`, { waitUntil: 'networkidle2' });

        await (await page.waitFor('input[name="Login"]')).asElement().type(login);
        await page.type('input[name="Password"]', password);
        await page.keyboard.press('Enter');
        console.log('Logging in...');

        const requestTrigger = (await page.waitFor('#quickSearchRadioGroupTooltip input')).asElement();
        await page.setRequestInterception(true);

        let token = null;
        await page.on('request', async request => {
            if(request.url().includes('HidePromoNotification')) {
                token = request._postData.substring(request._postData.indexOf('=')+1);
            }
            request.continue();
        });

        await requestTrigger.click();

        const cookiesArr = await page.cookies();
        let cookies = '';
        for(let cookie of cookiesArr) {
            cookies += cookie.name + '=' + cookie.value + '; ';
        }

        browser.close();

        const auth = {
            cookie: cookies,
            token: token,
        };

        console.log('Saving the cookies and token');
        fs.writeFileSync('auth.json', JSON.stringify(auth, null,2));
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
            })
    },

    createFolder: (chomikName, folderId, folderName, adultContent = false, password = '') => {
        if(headers.cookie.length === 0) throw Error('No cookie, login first');
        const url = 'https://chomikuj.pl/action/FolderOptions/NewFolderAction';
        const _headers = {
            headers,
            body: `FolderId=${folderId}&ChomikName=${chomikName}&FolderName=${folderName}&AdultContent=${adultContent}&Password=${password}&__RequestVerificationToken=${auth.token}`,
            method: 'POST'
        };

        return makeRequest(url, _headers)
            .then(res => res.json())
            .then(json => {
                if(json.Data !== null && json.Data.Status === 0) {
                    return json.Content;
                }
                else {
                    const $ = cheerio.load(json.Content);
                    if(json.Data !== null) return $('.errorText').text().trim();
                    else return $('div').text().trim();
                }
            })
    },

    copyFile: (chomikName, fileId, folderTo) => {
        if(headers.cookie.length === 0) throw Error('No cookie, login first');
        const url = 'http://chomikuj.pl/action/FileDetails/CopyFileAction';
        const _headers = {
            headers,
            body: `ChomikName=${chomikName}&FileId=${fileId}&FolderTo=${folderTo}`,
            method: 'POST'
        };

        return makeRequest(url, _headers)
            .then(res => res.json())
            .then(json => {
                if(json.Data !== null && json.Data.Status === 'OK') {
                    return json.Content;
                }
                else {
                    const $ = cheerio.load(json.Content);
                    if(json.Data !== null) return json.Content.trim();
                    else return $('div').text().trim();
                }
            })
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
        if(headers.cookie.length === 0) throw Error('No cookie, login first');
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

        return makeRequest(url, _headers)
            .then(res => res.json())
            .then(json => {
                if(json.Data !== null && json.Data.Status === 'OK') {
                    return json.Content;
                }
                else {
                    const $ = cheerio.load(json.Content);
                    if(json.Data !== null) return $('div.validation-summary-errors').text();
                    else return $('div').text().trim();
                }
            })
    }
};

module.exports = hamster;
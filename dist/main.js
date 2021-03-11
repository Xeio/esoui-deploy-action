"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const github = __importStar(require("@actions/github"));
const core = __importStar(require("@actions/core"));
const axios_1 = __importDefault(require("axios"));
const fs_1 = require("fs");
const form_data_1 = __importDefault(require("form-data"));
const fs = __importStar(require("fs"));
const GET_DETAILS_URL = 'https://api.esoui.com/addons/details/{0}.json';
const COMPAT_LIST_URL = 'https://api.esoui.com/addons/compatible.json';
const UPDATE_URL = 'https://api.esoui.com/addons/updatetest';
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const addOnDeclarationFile = core.getInput('addon-file-path');
            const uploadZipPath = core.getInput('upload-zip-path');
            const esouiApiKey = core.getInput('eso-ui-api-key');
            core.setSecret(esouiApiKey);
            const githubApiKey = core.getInput('github-api-key');
            core.setSecret(githubApiKey);
            core.info("Parsing add-on definition.");
            const addonInfo = yield parseAddonInfo(addOnDeclarationFile);
            if (addonInfo.apiVersions) {
                core.info("Translating API versions to ESO UI versions.");
                addonInfo.esouiVersions = yield translateAPIVersions(addonInfo.apiVersions, esouiApiKey);
            }
            addonInfo.addonId = core.getInput('addon-id');
            core.info("Retrieving changelog from release text.");
            addonInfo.releaseText = yield getReleaseText(githubApiKey);
            core.info("Parsed addon-data:");
            core.info(JSON.stringify(addonInfo));
            core.info("Sending update to ESO UI.");
            const response = yield sendUpdate(addonInfo, esouiApiKey, uploadZipPath);
            if (response.status != 202) {
                core.setFailed("Non-success response from ESO UI");
            }
            core.info("Update Response:");
            core.info(response.data);
        }
        catch (error) {
            core.setFailed(error.message);
        }
    });
}
function getReleaseText(githubApiKey) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const payload = process.env.GITHUB_EVENT_PATH ? require(process.env.GITHUB_EVENT_PATH) : {};
        const release_id = (_a = payload === null || payload === void 0 ? void 0 : payload.release) === null || _a === void 0 ? void 0 : _a.id;
        if (!release_id) {
            core.info("No release ID found, to pull change log needs to be tied to a release action.");
            return "";
        }
        const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
        const octokit = github.getOctokit(githubApiKey);
        const release = yield octokit.repos.getRelease({ owner, repo, release_id });
        return release.data.body || "";
    });
}
class AddOnInfo {
    constructor() {
        this.addonId = "";
    }
}
function parseAddonInfo(addOnDeclarationFile) {
    return __awaiter(this, void 0, void 0, function* () {
        const addOnFileData = (yield fs_1.promises.readFile(addOnDeclarationFile)).toString();
        var addonData = new AddOnInfo();
        const matchedAddonVersion = /## Version: (\d+)/.exec(addOnFileData);
        if (matchedAddonVersion) {
            addonData.addonVersion = matchedAddonVersion[1];
        }
        const matchedVersions = /## APIVersion: (\d+)(?: (\d+))?/.exec(addOnFileData);
        if (matchedVersions) {
            addonData.apiVersions = [matchedVersions[1]];
            if (matchedVersions.length > 2 && matchedVersions[2]) {
                addonData.apiVersions.push(matchedVersions[2]);
            }
        }
        return addonData;
    });
}
//Map the ESO API version (6 digit number) to the ESO UI version ID (i.e. 6.3.5)
function translateAPIVersions(versions, esouiApiKey) {
    return __awaiter(this, void 0, void 0, function* () {
        core.info("Sending update.");
        const response = yield axios_1.default.get(COMPAT_LIST_URL, {
            headers: {
                'x-api-token': esouiApiKey
            }
        });
        const esouiVersions = response.data;
        return versions.map(localVersion => { var _a; return ((_a = esouiVersions.find(apiV => apiV.interface == localVersion)) === null || _a === void 0 ? void 0 : _a.id) || ""; });
    });
}
function sendUpdate(addonInfo, esouiApiKey, zipPath) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        var updateData = new form_data_1.default();
        updateData.append('id', addonInfo.addonId);
        if (((_a = addonInfo.esouiVersions) === null || _a === void 0 ? void 0 : _a.length) || 0 > 0) {
            updateData.append('compatible', addonInfo.esouiVersions.join(","));
        }
        if (addonInfo.addonVersion) {
            updateData.append('version', addonInfo.addonVersion);
        }
        updateData.append('updatefile', fs.createReadStream(zipPath));
        if (addonInfo.releaseText) {
            updateData.append('changelog', addonInfo.releaseText);
        }
        return axios_1.default.post(UPDATE_URL, updateData, { headers: Object.assign({ 'x-api-token': esouiApiKey }, updateData.getHeaders()) });
    });
}
run();

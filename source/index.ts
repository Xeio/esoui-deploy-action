import * as github from '@actions/github'
import * as core from '@actions/core'
import axios, { AxiosResponse } from 'axios';
import { promises as fsPromises } from 'fs';
import FormData from 'form-data'
import * as fs from 'fs'

const GET_DETAILS_URL = 'https://api.esoui.com/addons/details/{0}.json'
const COMPAT_LIST_URL = 'https://api.esoui.com/addons/compatible.json'
const UPDATE_URL = 'https://api.esoui.com/addons/update'
const UPDATE_URL_TEST = 'https://api.esoui.com/addons/updatetest'

async function run(): Promise<void> {
  try {
    const addOnDeclarationFile: string = core.getInput('addon-file-path')
    const uploadZipPath: string = core.getInput('upload-zip-path')

    const esouiApiKey: string = core.getInput('eso-ui-api-key')
    core.setSecret(esouiApiKey)

    const githubApiKey: string = core.getInput('github-api-key')
    core.setSecret(githubApiKey)

    core.info("Parsing add-on definition.")

    const addonInfo = await parseAddonInfo(addOnDeclarationFile)
    if(addonInfo.apiVersions){
      core.info("Translating API versions to ESO UI versions.")
      addonInfo.esouiVersions = await translateAPIVersions(addonInfo.apiVersions, esouiApiKey)
    }
    addonInfo.addonId = core.getInput('addon-id')

    core.info("Retrieving changelog from release text.")
    addonInfo.releaseText = await getReleaseText(githubApiKey)

    core.info("Parsed addon-data:")
    core.info(JSON.stringify(addonInfo))
    
    core.info("Sending update to ESO UI.")

    const response = await sendUpdate(addonInfo, esouiApiKey, uploadZipPath)

    if(response.status != 202){
      core.setFailed("Non-success response from ESO UI")
    }

    core.info("Update Response:")
    core.info(response.data)    
  } catch (error) {
    core.setFailed(error.message)
  }
}

async function getReleaseText(githubApiKey:string): Promise<string>{
  const payload = process.env.GITHUB_EVENT_PATH ? require(process.env.GITHUB_EVENT_PATH) : {}
  const release_id: number = payload?.release?.id
  if(!release_id){
    core.info("No release ID found, to pull change log needs to be tied to a release action.")
    return ""
  }

  const [owner, repo] = process.env.GITHUB_REPOSITORY!.split('/')

  const octokit = github.getOctokit(githubApiKey)

  const release = await octokit.repos.getRelease({owner, repo, release_id})

  return release.data.body || ""
}

class AddOnInfo{
  addonId: string = "";
  addonVersion?: string;
  apiVersions?: string[];
  esouiVersions?: string[];
  releaseText?: string;
}

async function parseAddonInfo(addOnDeclarationFile:string): Promise<AddOnInfo> {
  const addOnFileData = (await fsPromises.readFile(addOnDeclarationFile)).toString()

  var addonData = new AddOnInfo()

  const matchedAddonVersion = /## Version: (\d+)/.exec(addOnFileData)
  if(matchedAddonVersion){
    addonData.addonVersion = matchedAddonVersion[1]
  }

  const matchedVersions = /## APIVersion: (\d+)(?: (\d+))?/.exec(addOnFileData)
  if(matchedVersions){
    addonData.apiVersions = [matchedVersions[1]]
    if(matchedVersions.length > 2 && matchedVersions[2]){
      addonData.apiVersions.push(matchedVersions[2])
    }
  }

  return addonData
}

interface APIVersion{
  id:string;
  name:string;
  interface:string;
  default:boolean;
}

//Map the ESO API version (6 digit number) to the ESO UI version ID (i.e. 6.3.5)
async function translateAPIVersions(versions:string[], esouiApiKey:string): Promise<string[]> {
  core.info("Sending update.")

  const response = await axios.get(COMPAT_LIST_URL, {
    headers: {
      'x-api-token': esouiApiKey
    }
  })
  const esouiVersions: APIVersion[] = response.data
  return versions.map(localVersion => esouiVersions.find(apiV => apiV.interface == localVersion)?.id || "")
}

async function sendUpdate(addonInfo:AddOnInfo, esouiApiKey:string, zipPath:string) : Promise<AxiosResponse<any>>{
  var updateData = new FormData()
  updateData.append('id', addonInfo.addonId)
  if(addonInfo.esouiVersions?.length || 0 > 0){
    updateData.append('compatible', addonInfo.esouiVersions!.join(","))
  }
  if(addonInfo.addonVersion){
    updateData.append('version', addonInfo.addonVersion)
  }
  updateData.append('updatefile', fs.createReadStream(zipPath))
  if(addonInfo.releaseText){
    updateData.append('changelog', addonInfo.releaseText)
  }

  var url = UPDATE_URL
  if(core.getInput('test-only') == "true"){
    url = UPDATE_URL_TEST
    core.info("Using update test endpoint")
  }
  return axios.post(url, updateData, { headers: {
    'x-api-token': esouiApiKey,
    ...updateData.getHeaders()
  }})
}

run()
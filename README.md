# esoui-deploy-action
 Deploys Add-On update to ESO UI.
 
 This is intended to run against a GitHub release action and pulls in the add-on Version and APIVersion from the addon definition text file. If tied to a GitHub Release action will also get the text body of that release and attach it as a changelog.
 
 
 
 Sample action file:
```yaml
name: Build zip and upload to ESO UI
on: 
  release:
      types: [published]
jobs:
    build-and-upload:
        runs-on: ubuntu-latest
        steps:
        - uses: actions/checkout@master
        with:
            #Folder that should live inside the zip, probably should match add-on name
            path: 'AddOnFolderName'

        - name: Zip release
        #Zips the release, excluding .git* and .vscode files
        run: 7z a esoui_release.zip * -xr!*.git* -xr!*.vscode*

        #Optional: Attaches the generated zip to the GitHub release (before uploading to ESO UI)
        - name: Attach zip to release
        uses: Shopify/upload-to-release@v1.0.1
        with:
            name: esoui_release.zip
            path: esoui_release.zip
            repo-token: ${{ secrets.GITHUB_TOKEN }}

        - name: ESO UI Publish
        uses: Xeio/esoui-deploy-action@main
        with:
            #Inside the folder configured above, this should be the add-on definition txt file (that has Title, Description, files, ect.)
            addon-file-path: ./AddOnFolderName/AddOnDefinitonFile.txt 
            #Match generated zip file name above
            upload-zip-path: esoui_release.zip
            #Add-on ID from ESO UI
            addon-id: 123456 
            #ESO UI API Key, should be stored in GitHub secrets
            eso-ui-api-key: ${{secrets.ESOUI_API_TOKEN}}
            github-api-key: ${{secrets.GITHUB_TOKEN}}
```

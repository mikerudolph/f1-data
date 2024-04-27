import { program } from 'commander'
import { readFile } from 'fs/promises'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const BASE_URL = 'https://livetiming.formula1.com/static/'

const SESSION_STREAMS = {
    SessionInfo: "SessionInfo.jsonStream",
    ArchiveStatus: "ArchiveStatus.jsonStream",
    TrackStatus: "TrackStatus.jsonStream",
    ExtrapolatedClock: "ExtrapolatedClock.jsonStream",
    "Position.z": "Position.z.jsonStream",
    "CarData.z": "CarData.z.jsonStream",
    AudioStreams: "AudioStreams.jsonStream",
    DriverList: "DriverList.jsonStream",
    TimingDataF1: "TimingDataF1.jsonStream",
    SPFeed: "SPFeed.jsonStream",
    TimingAppData: "TimingAppData.jsonStream",
    TimingData: "TimingData.jsonStream",
    TopThree: "TopThree.jsonStream",
    LapSeries: "LapSeries.jsonStream",
    TimingStats: "TimingStats.jsonStream",
    SessionStatus: "SessionStatus.jsonStream",
    TyreStintSeries: "TyreStintSeries.jsonStream",
    Heartbeat: "Heartbeat.jsonStream",
    WeatherData: "WeatherData.jsonStream",
    WeatherDataSeries: "WeatherDataSeries.jsonStream",
    TlaRcm: "TlaRcm.jsonStream",
    RaceControlMessages: "RaceControlMessages.jsonStream",
    TeamRadio: "TeamRadio.jsonStream",
    DriverScore: "DriverScore.jsonStream",
    CurrentTyres: "CurrentTyres.jsonStream",
    PitLaneTimeCollection: "PitLaneTimeCollection.jsonStream",
}

const readStreamToString = async (reader) => {
    let fileData = ""
    while (true) {
        const { done, value } = await reader.read()
        if (done) break;

        fileData += new TextDecoder().decode(value)
    }

    return fileData
}

const fetchIndex = async (location) => {
    const remote = `${BASE_URL}${location}/Index.json`
    const localPath = `./data/${location}/Index.json`

    if (existsSync(localPath)) {
        return JSON.parse((await readFile(localPath, 'utf-8')).trim())
    }

    const dirPath = localPath.substring(0, localPath.lastIndexOf('/'))

    mkdirSync(dirPath, { recursive: true })

    const indexData = await fetch(remote)
    if (indexData.status !== 200) return "Not Found"

    const reader = indexData.body.getReader()
    const fileData = await readStreamToString(reader)

    const output = JSON.parse(fileData)
    writeFileSync(resolve(localPath), JSON.stringify(output, null, 2), 'utf-8')

    return output
}

const walkSessionPaths = async (sessionPath) => {
    for (let [_, stream] of Object.entries(SESSION_STREAMS)) {
        const localPath = `./data/${sessionPath}${stream.replace('jsonStream', 'json')}`
        const directoryPath = localPath.substring(0, localPath.lastIndexOf('/'))

        if (existsSync(localPath)) {
            continue
        }

        mkdirSync(directoryPath, { recursive: true })

        const streamData = await fetch(`${BASE_URL}${sessionPath}${stream}`)
        if (streamData.status !== 200) {
            continue
        }

        const reader = streamData.body.getReader()
        const fileData = await readStreamToString(reader)
        const parsedFile = []

        fileData.trim().split('\r\n').forEach(line => {
            const [timestamp, ...jsonData] = line.split(/(?<=\d{2}:\d{2}:\d{2}\.\d{3})/)
            parsedFile.push({
                [timestamp]: jsonData.length > 0 ? JSON.parse(jsonData.join()) : ''
            })
        })

        writeFileSync(resolve(localPath), JSON.stringify(parsedFile, null, 2), 'utf-8')
    }
}

const run = async (year) => {
    const index = await fetchIndex(year)
    const meetings = index['Meetings']

    if (meetings === undefined || meetings.length === 0) {
        return console.log('Oh no! No meetings')
    }

    meetings.forEach(meeting => {
        const sessionPaths = meeting['Sessions'].filter(session => session['Path']).map(s => s['Path'])
        sessionPaths.forEach(async (path) => {
            await walkSessionPaths(path)
        })
    })
}

program.command('catalog')
    .argument('<int>', 'year to catalog')
    .action(run)

await program.parseAsync(process.argv)
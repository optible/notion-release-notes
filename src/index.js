/* eslint-disable no-tabs */
const core = require('@actions/core')
const { Client, LogLevel } = require('@notionhq/client')
const { markdownToBlocks } = require('@tryfabric/martian')

const createPageWithUUIDs = async () => {
  try {
    const body = core.getInput('body')
    const name = core.getInput('name')
    const token = core.getInput('token')
    const tags = core.getInput('tags') || ''
    const database = core.getInput('database')
    const date = new Date().toISOString()
    const ticketDatabase = core.getInput('ticket_database') // Assuming there's a separate database for tickets

    core.debug('Creating notion client ...')
    const notion = new Client({
      auth: token,
      logLevel: LogLevel.ERROR
    })

    const blocks = markdownToBlocks(body)
    const tagArray = tags ? tags.split(',').map((tag) => ({ name: tag })) : []

    core.debug('Extracting ticket IDs ...')
    const ticketIdPattern = /OPTIBLE-\d+/g
    const extractedTicketIds = body.match(ticketIdPattern)
    const uniqueTicketIds = [...new Set(extractedTicketIds)]

    const ticketUUIDs = await Promise.all(
      uniqueTicketIds.map(async (ticketId) => {
        // Query to find the page by a property that matches ticketId
        const response = await notion.databases.query({
          database_id: ticketDatabase,
          filter: {
            // Adjust this filter according to how ticket IDs are stored in your ticket database
            property: 'TicketID',
            text: {
              equals: ticketId
            }
          }
        })
        // Assuming the first result is the correct one, extract the UUID
        return response.results.length > 0
          ? { id: response.results[0].id }
          : null
      })
    )

    // Filter out any null values in case some ticket IDs didn't match a page
    const validTicketUUIDs = ticketUUIDs.filter((uuid) => uuid !== null)

    core.debug('Creating page with UUIDs ...')
    await notion.pages.create({
      parent: { database_id: database },
      properties: {
        Name: {
          title: [{ text: { content: name } }]
        },
        Tickets: {
          relation: validTicketUUIDs
        },
        Date: {
          date: { start: date }
        },
        Tags: {
          multi_select: tagArray
        }
      },
      children: blocks
    })

    core.setOutput('status', 'complete')
  } catch (error) {
    core.setFailed(error.message)
  }
}

createPageWithUUIDs()

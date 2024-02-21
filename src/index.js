const core = require("@actions/core");
const { Client, LogLevel } = require("@notionhq/client");
const { markdownToBlocks } = require("@tryfabric/martian");

try {
	// `who-to-greet` input defined in action metadata file
	const body = core.getInput("body");
	const name = core.getInput("name");
	const token = core.getInput("token");
	const tags = core.getInput("tags") || "";
	const database = core.getInput("database");
	const date = new Date().toISOString();

	core.debug("Creating notion client ...");
	const notion = new Client({
		auth: token,
		logLevel: LogLevel.ERROR,
	});

	const blocks = markdownToBlocks(body);
	const tagArray = tags
		? tags.split(",").flatMap((tag) => {
				return { name: tag };
		  })
		: [];

	core.debug("Creating page ...");

	const ticketIdPattern = /OPTIBLE-\d+/g;

	// Extract all occurrences of ticket IDs in the changelog
	const extractedTicketIds = body.match(ticketIdPattern);

	// Use Set to remove duplicates and then convert it back to an array
	const uniqueTicketIds = [...new Set(extractedTicketIds)];

	notion.pages
		.create({
			parent: {
				database_id: database,
			},
			properties: {
				Name: {
					title: [
						{
							text: {
								content: name,
							},
						},
					],
				},
				Tickets: {
					relation: uniqueTicketIds.map((id) => ({ id })),
				},
				Date: {
					date: {
						start: date,
					},
				},
				Tags: {
					multi_select: tagArray,
				},
			},
			children: blocks,
		})
		.then((result) => {
			core.debug(`${result}`);
			core.setOutput("status", "complete");
		});
} catch (error) {
	core.setFailed(error.message);
}

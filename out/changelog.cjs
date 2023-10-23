#!/usr/bin/env node

const fs = require('fs');
const {execSync} = require("child_process");
const {marked} = require("marked");
const {emojify} = require("node-emoji");

function getLogsByDate() {
	const logs = execSync(`git log --date=short`).toString();
	const commits = [];
	for (let log of logs.split(/[a-zA-Z0-9]{40}/)) {
		log = log.split('Date:   ')[1];
		if (!log) {
			continue;
		}
		const obj = {
			date: log.split('\n\n    ')[0],
			subject: log.split('\n\n    ')[1].split('\n\ncommit ')[0]
		}
		commits.push(obj);
	}

	const dates = {};
	for (const com of commits) {
		if (!dates[com.date]) {
			dates[com.date] = [];
		}
		dates[com.date].push(com);
	}
	return dates;
}

(async () => {
	try {
		const logs = getLogsByDate();

		let html = "";
		for (const [date, commit] of Object.entries(logs)) {
			let lis = '';
			for (const com of commit) {
				let sub = com.subject.trim();
				sub = emojify(sub);
				sub = marked(sub, {mangle: false, headerIds: false});
				sub = sub.replaceAll('\n', '<br>');
				sub = sub.replaceAll('\t', ' - ');
				if (sub.length < 30) {
					continue;
				}
				lis += `<li><div class='msg'>${sub}</div></li>`;
			}
			if (lis.length < 1) {
				continue;
			}
			html += `<div class='changelog-day'><h2>${date}</h2><ul>${lis}</ul></div>`;
		}

		fs.writeFileSync(process.argv[2], `<html><head>
<style>
	p {
		margin: 0px;
	}
	.changelog-day {
		display: flex; 
		flex-direction: row; 
		align-items: center; 
		justify-content: flex-start; 
		min-height: 130px;
	}
	h2 {
		margin-bottom: 0px; 
		transform: rotate(270deg); 
		white-space: nowrap; 
		width: 20px; 
		height: 36px; 
		min-width: 85px;
	}
	ul {
		border-left: 1px solid black;
	}
</style>
</head><body><div class='changelog'>${html}</div></body></html>`);
	} catch (error) {
		console.error(error);
	}
})();

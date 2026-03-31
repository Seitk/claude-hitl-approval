#!/usr/bin/env bun
// demo/joke.ts — tells a random engineer joke
// Used to demonstrate the HITL approval flow.

const jokes = [
  "Why do programmers prefer dark mode?\nBecause light attracts bugs.",
  "A QA engineer walks into a bar.\nOrders 1 beer. Orders 0 beers. Orders 99999999 beers.\nOrders -1 beers. Orders null beers. Orders asdfjkl; beers.\nFirst real customer walks in and asks where the bathroom is.\nThe bar bursts into flames.",
  "Why did the developer go broke?\nBecause they used up all their cache.",
  "There are 10 types of people in the world:\nThose who understand binary, and those who don't.",
  "A product manager walks into a bar.\nAsks for a beer. Then asks for another. Then asks for a third.\nSays 'great, now I need all three of these but only one glass.'",
  "How many programmers does it take to change a light bulb?\nNone — that's a hardware problem.",
  "Why do Java developers wear glasses?\nBecause they don't C#.",
  "A SQL query walks into a bar, walks up to two tables and asks...\n'Can I join you?'",
];

const joke = jokes[Math.floor(Math.random() * jokes.length)];
console.log("\n🤖 Engineer Joke of the Day:\n");
console.log(joke);
console.log();

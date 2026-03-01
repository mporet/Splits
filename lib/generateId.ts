const adjectives = [
    "rapid", "clever", "silent", "brave", "bright", "calm", "eager", "fierce", "gentle", "happy",
    "jolly", "kind", "lively", "proud", "silly", "smart", "swift", "warm", "wild", "wise",
    "bold", "cool", "deep", "fair", "fast", "good", "great", "high", "keen", "neat",
    "pure", "rich", "safe", "sharp", "soft", "strong", "sweet", "tall", "true", "vast"
];

const nouns = [
    "tiger", "eagle", "river", "mountain", "ocean", "forest", "valley", "desert", "island", "planet",
    "star", "moon", "sun", "cloud", "storm", "wind", "rain", "snow", "fire", "ice",
    "bear", "wolf", "fox", "lion", "hawk", "owl", "deer", "whale", "shark", "dolphin",
    "tree", "flower", "leaf", "rock", "stone", "sand", "wave", "tide", "breeze", "shadow"
];

export function generateHumanReadableId(): string {
    const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
    const randomNumber = Math.floor(Math.random() * 900) + 100; // 3 digit number

    return `${randomAdjective}-${randomNoun}-${randomNumber}`;
}

import re
from collections import Counter

STOPWORDS = {
    "the", "is", "are", "was", "were", "a", "an", "and", "or", "but", "to", "for", "of", "in", "on",
    "saya", "aku", "dan", "atau", "yang", "ini", "itu", "tak", "tidak", "belum", "sudah", "lah", "pun",
    "my", "i", "me", "you", "your", "it", "this", "that", "with", "from"
}


def simple_keyphrases(text: str, max_phrases: int = 5) -> list[str]:
    lower = text.lower()
    candidate_phrases: list[str] = []

    patterns = [
        r"charged twice",
        r"refund(?:\s+\w+){0,3}",
        r"login(?:\s+\w+){0,3}",
        r"payment(?:\s+\w+){0,3}",
        r"cannot access",
        r"tak boleh(?:\s+\w+){0,3}",
        r"belum masuk",
        r"order(?:\s+\w+){0,3}",
        r"delivery(?:\s+\w+){0,3}"
    ]

    for pattern in patterns:
        matches = re.findall(pattern, lower)
        candidate_phrases.extend(match.strip() for match in matches if match.strip())

    tokens = re.findall(r"[\w']+", lower)
    meaningful_tokens = [token for token in tokens if len(token) > 2 and token not in STOPWORDS]
    token_counts = Counter(meaningful_tokens)
    candidate_phrases.extend([token for token, _ in token_counts.most_common(max_phrases)])

    deduped: list[str] = []
    seen: set[str] = set()
    for phrase in candidate_phrases:
        if phrase not in seen:
            deduped.append(phrase)
            seen.add(phrase)
        if len(deduped) >= max_phrases:
            break
    return deduped

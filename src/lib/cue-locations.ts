import { sectionHeading } from './chord/transpose'

export const songCueLocation = 'song'

export function chartCueLocations(content: string) {
  const occurrences = new Map<string, number>()
  return content.split('\n').flatMap((line, lineIndex) => {
    const heading = sectionHeading(line)
    if (!heading) return []
    const occurrence = (occurrences.get(heading) ?? 0) + 1
    occurrences.set(heading, occurrence)
    return [{ id: JSON.stringify([heading, occurrence]), heading, occurrence, lineIndex }]
  }).map(location => ({
    ...location,
    label: occurrences.get(location.heading) === 1 ? location.heading : `${location.heading} (${location.occurrence})`,
  }))
}

export function cueLocationLabel(location: string) {
  try {
    const [heading, occurrence] = JSON.parse(location)
    return `${heading} (${occurrence}) · Heading unavailable`
  } catch {
    return 'Heading unavailable'
  }
}

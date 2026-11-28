export interface GitPerson {
  name: string
  email: string
  /** ISO 8601, as GitHub's API sends and accepts it. */
  date: string
}

export interface CommitFields {
  tree: string
  parent: string
  message: string
  author: GitPerson
  committer: GitPerson
}

// The raw commit object that git hashes and a signature covers. GitHub stores `message` exactly as sent, without adding a trailing newline.
export function commitPayload(commit: CommitFields): string {
  return [
    `tree ${commit.tree}`,
    `parent ${commit.parent}`,
    `author ${formatPerson(commit.author)}`,
    `committer ${formatPerson(commit.committer)}`,
    '',
    commit.message
  ].join('\n')
}

// GitHub stores a `Z` date with a +0000 offset. Sending every date in this form keeps the payload and the stored commit identical.
export function utcDate(date: string | Date): string {
  return new Date(date).toISOString().replace(/\.\d{3}Z$/, 'Z')
}

function formatPerson(person: GitPerson) {
  return `${person.name} <${person.email}> ${Math.floor(Date.parse(person.date) / 1000)} +0000`
}

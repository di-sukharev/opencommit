import { getCommitMsgsPromisesFromFileDiffs } from '../src/generateCommitMessageFromGitDiff';

const oneFileThreeChanges = `diff --git a/example.txt b/example.txt
index e69de29..3f6a3fa 100644
--- a/example.txt
+++ b/example.txt
@@ -1,2 +1,2 @@
-Hello, World!
+Hello, everyone!
 This is an example file.
@@ -4,2 +4,2 @@
-Goodbye, World!
+Goodbye, everyone!
 Have a great day!
@@ -7,2 +7,2 @@
-It's a sunny day!
+It's a rainy day!
 Let's go for a walk.`;

const fourFilesOneChangeEach = `diff --git a/file1.txt b/file1.txt
 index e69de29..3f6a3fa 100644
 --- a/file1.txt
 +++ b/file1.txt
 @@ -1,2 +1,2 @@
 -Hello, World!
 +Hello, everyone!
  This is file 1.

 diff --git a/file2.txt b/file2.txt
 index 87c0ddc..d7b182e 100644
 --- a/file2.txt
 +++ b/file2.txt
 @@ -1,3 +1,3 @@
  This is file 2.
 -Goodbye, World!
 +Goodbye, everyone!
  Have a great day!

 diff --git a/file3.txt b/file3.txt
 index e69de29..3f6a3fa 100644
 --- a/file3.txt
 +++ b/file3.txt
 @@ -1,4 +1,4 @@
  This is file 3.
 -It's a sunny day!
 +It's a rainy day!
  Let's go for a walk.

 diff --git a/file4.txt b/file4.txt
 index 3f6a3fa..87c0ddc 100644
 --- a/file4.txt
 +++ b/file4.txt
 @@ -1,5 +1,5 @@
  This is file 4.
 -It's time to sleep.
 +It's time to wake up.
  Goodnight.
 `;

test('1', async () => {
  const MAX_LENGTH = 50;
  const oneFile3Changes = await getCommitMsgsPromisesFromFileDiffs(
    oneFileThreeChanges,
    MAX_LENGTH
  );

  expect(oneFile3Changes).toBe('lol');
});

test('2', async () => {
  const MAX_LENGTH = 50;

  const fourFilesOneChange = await getCommitMsgsPromisesFromFileDiffs(
    fourFilesOneChangeEach,
    MAX_LENGTH
  );

  expect(fourFilesOneChange).toBe('lol');
});

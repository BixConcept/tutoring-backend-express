-- MADE BY nicht niels
--Ich möchte Nachhilfe:
SELECT
    *
FROM
    Nachhilfe.user
WHERE
    user.id = offer.user_id
    AND offer.subject_id = [request.subject:_id]
    AND offer.grade >= [request.grade]
    AND user.auth = 1;

--Ich möchte Nachhilfe geben:
INSERT INTO
    ‘ nachhilfe.offer ‘ (id, user_id, subject_id, grade)
VALUES
    (NULL, [user.id], [subject_id], [grade]);

-- Vergleiche mit request:
SELECT
    user.email
FROM
    nachhilfe.user
WHERE
    offer.subject_id = request.subject_id
    AND request.grade <= offer.grade;

-- verifizieren:
UPDATE
    nachhilfe.user
SET
    auth = 1
WHERE
    [user_id];

--Ich möchte keine Nachhilfe mehr geben:
DELETE FROM
    nachhilfe.offer
WHERE
    offer.user_id = [user_id];

--Trag mich IN die Warteliste ein:
INSERT INTO
    nachhilfe.request (id, user_id, subject_id)
VALUES
    (NULL, [user_id], [subject_id]);

--Trag mich aus der Warteliste aus:
DELETE FROM
    nachhilfe.request
WHERE
    request.user_id = [user_id]
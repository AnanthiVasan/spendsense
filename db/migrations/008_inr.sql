ALTER TABLE transactions ALTER COLUMN iso_currency_code SET DEFAULT 'INR';
UPDATE transactions SET iso_currency_code = 'INR' WHERE iso_currency_code = 'USD';

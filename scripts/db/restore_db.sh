#!/usr/bin/env bash
psql "$PG_URL" < dump.sql

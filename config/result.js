import { request } from "https";
const REPO_FILE = "./repo.txt";
import xml2js from "xml2js";
const UNIT_TEST_RESULT_PATH = "../test-results.xml";
import fs from "fs";
import { scores } from "./scores.js";

const getXMLData = () => {
  return fs.readFileSync(UNIT_TEST_RESULT_PATH, "utf8");
};

const testResultsToJson = (xmlData) => {
  const parser = new xml2js.Parser();
  return parser.parseStringPromise(xmlData);
};

const getJsonTestResults = async () => {
  const xmlData = getXMLData();
  return testResultsToJson(xmlData);
};

const postData = async () => {
  const repoName = process.env.CODE_COMMIT_REPO;
  const unitTest = await getJsonTestResults();
  const { tests, failures } = unitTest.testsuites.$;

  const summary = {
    date: new Date(),
    tests: tests,
    failures,
  };

  let result;
  let currentTestCase;
  let scoreData;
  const testResults = unitTest.testsuites.testsuite;
  const bugFixing = [];
  const featureImplementation = [];

  for (result in testResults) {
    currentTestCase = testResults[result].testcase;

    for (let testcaseIndex in currentTestCase) {
      const testName = currentTestCase[testcaseIndex].$.name;
      const index = testName.indexOf("Challenge");
      let name = testName;
      if(index !== -1){
        name = testName.slice(index);
      }
      
      // Extract challenge number and part for mapping
      const challengeMatch = testName.match(/Challenge (\d+[a-z]?-\d+)/);
      if (challengeMatch) {
        const challengeId = challengeMatch[1];
        
        // Try to find matching score by challenge ID pattern
        scoreData = scores.bugs.find((score) => {
          return score.desc.includes(challengeId) || score.desc.includes(challengeId.replace('-', 'a-')) || score.desc.includes(challengeId.replace('-', 'b-'));
        });
        
        if (scoreData === undefined) {
          scoreData = scores.features.find((score) => {
            return score.desc.includes(challengeId) || score.desc.includes(challengeId.replace('-', 'a-')) || score.desc.includes(challengeId.replace('-', 'b-'));
          });
          
          if (scoreData !== undefined) {
            featureImplementation.push({
              fullName: name,
              success: currentTestCase[testcaseIndex].failure ? false : true,
              score: scoreData.score,
            });
          } else {
            // If no exact match found, assign to features with default score
            featureImplementation.push({
              fullName: name,
              success: currentTestCase[testcaseIndex].failure ? false : true,
              score: 20, // Default score
            });
          }
        } else {
          bugFixing.push({
            fullName: name,
            success: currentTestCase[testcaseIndex].failure ? false : true,
            score: scoreData.score,
          });
        }
      }
    }
  }
  
  const params = {
    repoName,
    summary,
    bugFixing,
    featureImplementation,
  };
  return params;
};

const sendReportData = async () => {
  const data = await postData();
  console.log(data);
  const options = {
    hostname: "app.devgrade.io",
    path: "/assessments/report",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(JSON.stringify(data)),
    },
  };

  const req = request(options, (res) => {});
  req.write(JSON.stringify(data));
  req.end();
};

sendReportData();

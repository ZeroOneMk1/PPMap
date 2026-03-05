import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import * as api from "../../api";
import "../../common.css"; // reuse same styles
import "./EditAccount.css";

// This will be the account management page that holds renaming, password updating, and discoverability toggling
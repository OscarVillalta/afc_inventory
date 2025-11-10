const mockFilters = [
  {
    id: 1,
    part_number: "FGP-CARB-1/1",
    supplier: "EFS",
    rating: 8,
    height: 24,
    width: 24,
    depth: 12,
    location: "Warehouse A",
    on_hand: 25,
  },
  {
    id: 2,
    part_number: "F8V3-BOX-24X24X12",
    supplier: "AAF",
    rating: 8,
    height: 24,
    width: 24,
    depth: 12,
    location: "Warehouse B",
    on_hand: 3,
  },
  {
    id: 3,
    part_number: "HVP-MINI-95",
    supplier: "Camfil",
    rating: 13,
    height: 12,
    width: 24,
    depth: 6,
    location: "Warehouse C",
    on_hand: 8,
  },
];

import Card from "@mui/material/Card";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import { Chip, Grid } from "@mui/material";

function Filters() {
  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={1}>
        <Grid container spacing={2}>
          
        </Grid>
      </MDBox>
    </DashboardLayout>
  );
}

export default Filters;

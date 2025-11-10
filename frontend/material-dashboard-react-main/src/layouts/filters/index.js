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
import { Chip } from "@mui/material";

function Filters() {
  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <Card>
          <MDBox
            p={3}
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            borderBottom="1px solid #eee"
          >
            <MDTypography variant="h5" fontWeight="medium">
              Filter Inventory
            </MDTypography>
            <MDTypography variant="button" color="primary" sx={{ cursor: "pointer" }}>
              + Add Filter
            </MDTypography>
          </MDBox>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>
                    <strong>Part Number</strong>
                  </TableCell>
                  <TableCell>Supplier</TableCell>
                  <TableCell>Rating</TableCell>
                  <TableCell>Size (HxWxD)</TableCell>
                  <TableCell>Location</TableCell>
                  <TableCell align="center">On Hand</TableCell>
                  <TableCell align="center">Status</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {mockFilters.map((f) => (
                  <TableRow key={f.id} hover>
                    <TableCell>{f.part_number}</TableCell>
                    <TableCell>{f.supplier}</TableCell>
                    <TableCell>{f.rating}</TableCell>
                    <TableCell>{`${f.height}x${f.width}x${f.depth}`}</TableCell>
                    <TableCell>{f.location}</TableCell>
                    <TableCell align="center">{f.on_hand}</TableCell>
                    <TableCell align="center">
                      {f.on_hand < 5 ? (
                        <Chip label="Low Stock" color="error" size="small" />
                      ) : (
                        <Chip label="In Stock" color="success" size="small" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      </MDBox>
    </DashboardLayout>
  );
}

export default Filters;
